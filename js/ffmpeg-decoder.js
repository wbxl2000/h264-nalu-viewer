// FFmpeg.wasm 解码器模块
// 用于处理H.264视频解码预览功能，作为WebCodecs解码器的替代方案

// 状态变量
let isFFmpegLoaded = false;
let isFFmpegLoading = false;
let isDecoding = false;
let videoPlayer = null;

// 加载FFmpeg WASM
async function loadFFmpeg() {
    if (isFFmpegLoaded) return true;
    if (isFFmpegLoading) {
        // 如果正在加载，等待加载完成
        while (isFFmpegLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return isFFmpegLoaded;
    }

    try {
        isFFmpegLoading = true;
        console.log('正在加载FFmpeg.wasm...');
        
        // 使用全局的FFmpeg对象
        if (!window.FFmpeg) {
            throw new Error('FFmpeg对象不存在，请确保已加载相关库');
        }

        // 使用真实的FFmpeg.wasm API
        const { createFFmpeg } = FFmpeg;
        window.ffmpeg = createFFmpeg({ 
            log: true,
            corePath: './lib/ffmpeg-core.js'
        });
        
        await window.ffmpeg.load();
        
        isFFmpegLoaded = true;
        console.log('FFmpeg.wasm加载成功');
        return true;
    } catch (error) {
        console.error('加载FFmpeg.wasm失败:', error);
        alert('加载FFmpeg.wasm失败: ' + error.message);
        return false;
    } finally {
        isFFmpegLoading = false;
    }
}

// 使用FFmpeg解码H.264文件
async function decodeH264WithFFmpeg(currentNALUs) {
    if (isDecoding) {
        console.warn('已有解码任务在进行中');
        return;
    }

    if (!await loadFFmpeg()) {
        return;
    }

    isDecoding = true;
    const ffmpeg = window.ffmpeg;

    // 显示加载指示器
    const videoContainer = document.getElementById('videoContainer');
    videoContainer.style.display = 'block';
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.textContent = '正在准备FFmpeg解码...';
    videoContainer.appendChild(loadingIndicator);

    try {
        // 将NALU数据转换为完整的H.264文件
        const h264Data = convertNALUsToH264(currentNALUs);
        if (!h264Data || h264Data.length === 0) {
            throw new Error('无法生成有效的H.264数据');
        }

        console.log(`准备使用FFmpeg解码，数据大小: ${h264Data.length} 字节`);
        
        // 写入文件到FFmpeg虚拟文件系统
        ffmpeg.FS('writeFile', 'input.h264', h264Data);
        
        loadingIndicator.textContent = '正在解码...';
        
        // 使用FFmpeg将H.264转换为MP4格式
        // 对于H.264原始流，需要指定格式
        await ffmpeg.run(
            '-f', 'h264',
            '-i', 'input.h264', 
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-pix_fmt', 'yuv420p',
            'output.mp4'
        );
        
        console.log('FFmpeg解码完成，已生成MP4文件');
        
        // 读取生成的MP4文件
        const data = ffmpeg.FS('readFile', 'output.mp4');
        
        // 创建视频元素
        await createVideoPlayer(data, videoContainer);
        
        loadingIndicator.textContent = '解码完成，正在播放';
        
        // 3秒后隐藏加载指示器
        setTimeout(() => {
            if (loadingIndicator.parentNode) {
                loadingIndicator.parentNode.removeChild(loadingIndicator);
            }
        }, 3000);
        
    } catch (error) {
        console.error('FFmpeg解码失败:', error);
        loadingIndicator.textContent = `解码失败: ${error.message}`;
        
        // 5秒后隐藏加载指示器
        setTimeout(() => {
            if (loadingIndicator.parentNode) {
                loadingIndicator.parentNode.removeChild(loadingIndicator);
            }
        }, 5000);
    } finally {
        isDecoding = false;
    }
}

// 将NALU数组转换为完整的H.264文件
function convertNALUsToH264(nalus) {
    if (!nalus || nalus.length === 0) return null;
    
    // 估算总大小
    const totalSize = nalus.reduce((size, nalu) => size + nalu.length, 0);
    const h264Data = new Uint8Array(totalSize);
    
    let offset = 0;
    for (const nalu of nalus) {
        h264Data.set(nalu.data, offset);
        offset += nalu.length;
    }
    
    return h264Data;
}

// 创建视频播放器
async function createVideoPlayer(videoData, container) {
    // 清理现有的视频元素
    if (videoPlayer) {
        videoPlayer.pause();
        if (videoPlayer.parentNode) {
            videoPlayer.parentNode.removeChild(videoPlayer);
        }
        videoPlayer = null;
    }
    
    // 隐藏Canvas元素，使用video元素代替
    const canvas = document.getElementById('videoCanvas');
    canvas.style.display = 'none';
    
    // 创建视频元素
    videoPlayer = document.createElement('video');
    videoPlayer.id = 'ffmpegVideo';
    videoPlayer.controls = true;
    videoPlayer.autoplay = true;
    videoPlayer.style.width = '100%';
    videoPlayer.style.maxHeight = '500px';
    videoPlayer.style.backgroundColor = '#000';
    
    // 创建视频Blob URL
    const videoBlob = new Blob([videoData], { type: 'video/mp4' });
    const videoUrl = URL.createObjectURL(videoBlob);
    
    // 设置视频源
    videoPlayer.src = videoUrl;
    
    // 添加到容器
    container.appendChild(videoPlayer);
    
    // 视频加载完成后的处理
    return new Promise((resolve) => {
        videoPlayer.onloadedmetadata = () => {
            console.log(`视频加载完成，尺寸: ${videoPlayer.videoWidth}x${videoPlayer.videoHeight}`);
            resolve();
        };
        
        // 出错时的处理
        videoPlayer.onerror = (e) => {
            console.error('视频加载错误:', e);
            resolve(); // 仍然resolve，避免卡住
        };
    });
}

// 关闭视频播放器
function closeFFmpegPlayer() {
    document.getElementById('videoContainer').style.display = 'none';
    isDecoding = false;
    
    // 清理视频播放器
    if (videoPlayer) {
        videoPlayer.pause();
        videoPlayer.src = '';
        if (videoPlayer.parentNode) {
            videoPlayer.parentNode.removeChild(videoPlayer);
        }
        videoPlayer = null;
    }
    
    // 恢复Canvas显示
    const canvas = document.getElementById('videoCanvas');
    canvas.style.display = 'block';
    
    // 清理FFmpeg资源
    cleanupFFmpeg();
}

// 清理FFmpeg资源
function cleanupFFmpeg() {
    if (window.ffmpeg) {
        try {
            // 删除临时文件
            const files = ['input.h264', 'output.mp4'];
            for (const file of files) {
                try {
                    window.ffmpeg.FS('unlink', file);
                } catch (e) {
                    // 忽略文件不存在的错误
                }
            }
        } catch (e) {
            console.warn('清理FFmpeg资源时出错:', e);
        }
    }
}

// 导出模块接口
export default {
    loadFFmpeg,
    decodeH264WithFFmpeg,
    closeFFmpegPlayer,
    cleanupFFmpeg,
    isDecoding: () => isDecoding
}; 