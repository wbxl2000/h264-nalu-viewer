// H.264解码器模块
// 用于处理H.264视频解码预览功能

// 状态变量
let videoDecoder = null;
let isDecoding = false;
let frameCounter = 0;
let decoderClosed = false;

// 检查WebCodecs支持
function checkWebCodecsSupport() {
    if (!('VideoDecoder' in window)) {
        alert('您的浏览器不支持WebCodecs API，无法使用解码预览功能。');
        return false;
    }
    return true;
}

// 创建H.264解码器配置数据 (AVCDecoderConfigurationRecord)
function createExtraData(sps, pps) {
    if (!sps || !pps) {
        console.error('缺少SPS或PPS，无法创建解码器配置');
        return null;
    }
    
    try {
        // 提取不包含起始码的SPS和PPS数据
        const spsData = sps.data.slice(sps.startCode);
        const ppsData = pps.data.slice(pps.startCode);
        
        // 创建AVCC格式配置数据
        const totalLength = 8 + spsData.length + 3 + ppsData.length;
        const extraData = new Uint8Array(totalLength);
        let offset = 0;
        
        // 1 byte: configurationVersion = 1
        extraData[offset++] = 1;
        
        // 3 bytes: profile data from SPS
        extraData[offset++] = spsData[0];  // profile_idc
        extraData[offset++] = spsData[1];  // profile_compatibility
        extraData[offset++] = spsData[2];  // level_idc
        
        // 1 byte: 6 bits reserved (0b111111) + 2 bits nal length size - 1 (0b11)
        extraData[offset++] = 0xFF;
        
        // 1 byte: 3 bits reserved (0b111) + 5 bits number of SPS (0b00001)
        extraData[offset++] = 0xE1;
        
        // 2 bytes: SPS length (network byte order)
        extraData[offset++] = (spsData.length >> 8) & 0xFF;
        extraData[offset++] = spsData.length & 0xFF;
        
        // Copy SPS data
        extraData.set(spsData, offset);
        offset += spsData.length;
        
        // 1 byte: number of PPS
        extraData[offset++] = 1;
        
        // 2 bytes: PPS length (network byte order)
        extraData[offset++] = (ppsData.length >> 8) & 0xFF;
        extraData[offset++] = ppsData.length & 0xFF;
        
        // Copy PPS data
        extraData.set(ppsData, offset);
        
        console.log("解码器配置创建成功，总长度：", totalLength);
        return extraData;
    } catch (e) {
        console.error('创建解码器配置失败:', e);
        return null;
    }
}

// 根据SPS创建正确的codec字符串
function createCodecString(spsData) {
    try {
        // 提取不包含起始码的SPS数据
        // profile_idc, profile_compatibility, level_idc
        const profile = spsData[0];
        const compatibility = spsData[1];
        const level = spsData[2];
        
        // 构建标准的codec字符串
        const codec = `avc1.${profile.toString(16).padStart(2, '0')}${compatibility.toString(16).padStart(2, '0')}${level.toString(16).padStart(2, '0')}`;
        console.log(`根据SPS生成codec字符串: ${codec}`);
        return codec;
    } catch (e) {
        console.error('生成codec字符串失败:', e);
        // 返回默认值
        return 'avc1.640028';
    }
}

// 显示视频帧
function displayVideoFrame(frame) {
    const canvas = document.getElementById('videoCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制视频帧
    ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
    
    // 显示帧信息
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, 10, 200, 30);
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText(`帧: ${frameCounter} / 时间戳: ${Math.floor(frame.timestamp / 1000)} ms`, 15, 30);
}

// 解码整个H.264文件
async function decodeEntireFile(currentNALUs, parseSPSData) {
    // 重置状态
    isDecoding = true;
    frameCounter = 0;
    decoderClosed = false;

    if (!currentNALUs || currentNALUs.length === 0) {
        alert('请先加载H.264文件');
        isDecoding = false;
        return;
    }
    
    console.log(`开始解码整个文件，包含 ${currentNALUs.length} 个NALU单元`);
    
    // 查找必要的NALU
    let spsNalu = currentNALUs.find(nalu => nalu.type === 7);
    let ppsNalu = currentNALUs.find(nalu => nalu.type === 8);
    let firstIDRNalu = currentNALUs.find(nalu => nalu.type === 5);
    
    if (!spsNalu || !ppsNalu || !firstIDRNalu) {
        alert('文件中缺少必要的SPS、PPS或IDR帧，无法解码');
        isDecoding = false;
        return;
    }
    
    console.log(`找到SPS: ${spsNalu.startIndex}, PPS: ${ppsNalu.startIndex}, 首个IDR: ${firstIDRNalu.startIndex}`);
    
    // 显示加载指示器
    const videoContainer = document.getElementById('videoContainer');
    videoContainer.style.display = 'block';
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.textContent = '正在准备解码...';
    videoContainer.appendChild(loadingIndicator);
    
    try {
        // 解析SPS获取分辨率信息
        let width = 640, height = 480; // 默认值
        const spsInfo = parseSPSData(spsNalu.data);
        if (spsInfo) {
            width = spsInfo.width;
            height = spsInfo.height;
            console.log(`视频分辨率: ${width}x${height}`);
        }
        
        // 设置Canvas尺寸
        const canvas = document.getElementById('videoCanvas');
        canvas.width = width;
        canvas.height = height;
        
        // 关闭之前的解码器
        if (videoDecoder) {
            try {
                await videoDecoder.flush();
                videoDecoder.close();
            } catch (e) {
                console.warn('关闭上一个解码器失败:', e);
            }
            videoDecoder = null;
        }
        
        // 创建解码器
        videoDecoder = new VideoDecoder({
            output: frame => {
                displayVideoFrame(frame);
                frame.close();
                frameCounter++;
                
                // 更新加载指示器
                if (frameCounter % 10 === 0 || frameCounter === 1) {
                    loadingIndicator.textContent = `已解码 ${frameCounter} 帧`;
                }
            },
            error: e => {
                console.error('解码错误:', e);
                decoderClosed = true; // 标记解码器已关闭
                
                // 如果已经解码了一些帧，则只显示警告
                if (frameCounter > 0) {
                    console.warn(`解码器错误，但已成功解码 ${frameCounter} 帧`);
                    loadingIndicator.textContent = `部分解码完成，共 ${frameCounter} 帧`;
                } else {
                    alert(`解码错误: ${e.message}`);
                    
                    // 移除加载指示器
                    if (loadingIndicator.parentNode) {
                        loadingIndicator.parentNode.removeChild(loadingIndicator);
                    }
                }
            }
        });
        
        try {
            // 创建编解码器配置
            const extraData = createExtraData(spsNalu, ppsNalu);
            
            // 获取SPS数据用于生成codec字符串
            const spsDataWithoutStartCode = spsNalu.data.slice(spsNalu.startCode);
            const codecString = createCodecString(spsDataWithoutStartCode);
            
            // 配置解码器
            videoDecoder.configure({
                codec: codecString,
                description: extraData,
                optimizeForLatency: true
            });
            
            loadingIndicator.textContent = '开始解码...';
            
            // 提取包含关键帧的NALU序列
            const naluSequence = [];
            let foundKeyFrame = false;
            
            // 首先添加所有类型为5的IDR帧和后续的非IDR帧
            for (const nalu of currentNALUs) {
                if (nalu.type === 5) { // IDR关键帧
                    naluSequence.push(nalu);
                    foundKeyFrame = true;
                } else if (foundKeyFrame && (nalu.type === 1 || nalu.type === 6)) {
                    // 添加在IDR帧之后的非IDR帧和SEI
                    naluSequence.push(nalu);
                }
            }
            
            console.log(`准备解码 ${naluSequence.length} 个NALU`);
            
            // 帧率估算 - 假设常见的帧率
            const estimatedFps = 30;
            const frameDurationUs = 1000000 / estimatedFps;
            
            // 一个一个地发送NALU
            for (let i = 0; i < naluSequence.length && !decoderClosed; i++) {
                const nalu = naluSequence[i];
                const isKeyFrame = nalu.type === 5;
                
                try {
                    // 提取NALU数据，包括起始码
                    const chunk = new EncodedVideoChunk({
                        type: isKeyFrame ? 'key' : 'delta',
                        timestamp: i * frameDurationUs, // 使用序列索引和帧率估算时间戳
                        data: nalu.data.buffer.slice(
                            nalu.data.byteOffset,
                            nalu.data.byteOffset + nalu.length
                        )
                    });
                    
                    videoDecoder.decode(chunk);
                    
                    // 更新进度
                    if (i % 10 === 0 || i === naluSequence.length - 1) {
                        const progress = Math.floor((i + 1) / naluSequence.length * 100);
                        loadingIndicator.textContent = `解码中... ${progress}%`;
                    }
                    
                    // 每20个NALU暂停一下，让UI更新
                    if (i % 20 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                } catch (e) {
                    if (decoderClosed) {
                        console.warn('解码器已关闭，停止解码');
                        break;
                    }
                    console.error(`解码NALU索引 ${i} 时出错:`, e);
                }
            }
            
            // 如果解码器未关闭，尝试刷新
            if (!decoderClosed) {
                await videoDecoder.flush();
                console.log(`成功解码 ${frameCounter} 帧`);
                
                // 更新状态
                loadingIndicator.textContent = `解码完成，共 ${frameCounter} 帧`;
                
                // 3秒后隐藏加载指示器
                setTimeout(() => {
                    if (loadingIndicator.parentNode) {
                        loadingIndicator.parentNode.removeChild(loadingIndicator);
                    }
                }, 3000);
            }
        } catch (e) {
            console.error('解码过程中出错:', e);
            
            // 如果已经解码了一些帧，则只显示警告
            if (frameCounter > 0) {
                console.warn(`解码过程中出错，但已成功解码 ${frameCounter} 帧`);
                loadingIndicator.textContent = `部分解码完成，共 ${frameCounter} 帧`;
            } else {
                alert(`解码失败: ${e.message}`);
                
                // 移除加载指示器
                if (loadingIndicator.parentNode) {
                    loadingIndicator.parentNode.removeChild(loadingIndicator);
                }
            }
        }
    } catch (e) {
        console.error('准备解码过程中出错:', e);
        alert(`准备解码失败: ${e.message}`);
        
        // 移除加载指示器
        if (loadingIndicator.parentNode) {
            loadingIndicator.parentNode.removeChild(loadingIndicator);
        }
    } finally {
        isDecoding = false;
    }
}

// 关闭视频播放器
function closeVideoPlayer() {
    document.getElementById('videoContainer').style.display = 'none';
    
    if (videoDecoder) {
        try {
            videoDecoder.flush().then(() => {
                videoDecoder.close();
                videoDecoder = null;
            }).catch(e => {
                console.warn('关闭解码器失败:', e);
                videoDecoder = null;
            });
        } catch (e) {
            console.warn('关闭解码器时出错:', e);
            videoDecoder = null;
        }
    }
}

// 导出模块接口
export default {
    checkWebCodecsSupport,
    decodeEntireFile,
    closeVideoPlayer,
    isDecoding: () => isDecoding
}; 