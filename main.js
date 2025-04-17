// 添加CSS样式
const style = document.createElement('style');
style.textContent = `
.sps-json {
    margin-top: 20px;
    border-top: 1px solid var(--border-color);
    padding-top: 15px;
}

.sps-json pre {
    background-color: var(--secondary-bg-color);
    border-radius: 4px;
    padding: 12px;
    overflow-x: auto;
    font-family: monospace;
    font-size: 12px;
    line-height: 1.4;
    color: var(--text-color);
    max-height: 400px;
    overflow-y: auto;
}
`;
document.head.appendChild(style);

// NALU 类型常量
const NALU_TYPES = {
    1: { name: "非IDR图像片", color: "var(--success-color)", description: "非关键帧" },
    5: { name: "IDR图像片", color: "var(--primary-color)", description: "关键帧" },
    6: { name: "SEI", color: "var(--info-color)", description: "补充增强信息" },
    7: { name: "SPS", color: "var(--danger-color)", description: "序列参数集" },
    8: { name: "PPS", color: "var(--warning-color)", description: "图像参数集" },
    9: { name: "分隔符", color: "var(--dark-color)", description: "访问单元分隔符" },
    10: { name: "序列结束", color: "var(--secondary-color)", description: "序列结束符" },
    11: { name: "码流结束", color: "var(--disabled-color)", description: "码流结束符" },
    12: { name: "填充", color: "var(--border-color)", description: "填充数据" }
};

// 十六进制显示用的简化NALU类型
const HEX_NALU_TYPES = {
    1: "非IDR",
    5: "IDR",
    6: "SEI",
    7: "SPS",
    8: "PPS",
    9: "AUD",
    10: "EOS",
    11: "EOB",
    12: "FIL"
};

// 全局状态
let currentNALUs = [];
let currentNALUIndex = -1;
let fileData = null;

// 导入 SPS 解析库
import spsPpsParser from './js/sps-pps.esm.js';

// 文件处理相关函数
function formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function handleFile(file) {
    if (!file.name.endsWith('.264') && !file.name.endsWith('.h264')) {
        alert('请选择 .264 或 .h264 文件');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        fileData = new Uint8Array(e.target.result);
        processH264File();
    };
    reader.readAsArrayBuffer(file);

    // 更新UI显示
    document.querySelector('.file-name').textContent = file.name;
    document.querySelector('.file-size').textContent = formatFileSize(file.size);
    document.querySelector('.file-info').style.display = 'block';
    document.getElementById('clearFile').style.display = 'inline-block';
    document.getElementById('uploadSection').classList.add('has-file');
}

function clearFile() {
    fileData = null;
    currentNALUs = [];
    currentNALUIndex = -1;

    document.querySelector('.file-name').textContent = '';
    document.querySelector('.file-size').textContent = '';
    document.querySelector('.file-info').style.display = 'none';
    document.getElementById('clearFile').style.display = 'none';
    document.getElementById('fileInput').value = '';
    document.getElementById('naluInfo').innerHTML = '<div class="nalu-type">未选择 NALU</div>';
    document.getElementById('hexContent').innerHTML = '';
    document.getElementById('naluCounter').textContent = '0/0';
    document.getElementById('uploadSection').classList.remove('has-file');
    document.getElementById('naluSequencePanel').style.display = 'none';
    // 清理tooltip
    const tooltip = document.querySelector('.nalu-sequence-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// NALU 处理相关函数
function processH264File() {
    if (!fileData) return;

    const nalus = [];
    let currentIndex = 0;

    // NALU统计对象
    const naluStats = {};
    Object.keys(NALU_TYPES).forEach(type => {
        naluStats[type] = 0;
    });

    while (currentIndex < fileData.length) {
        // 查找起始码
        let startCodeLength = 0;
        if (currentIndex + 4 <= fileData.length &&
            fileData[currentIndex] === 0x00 &&
            fileData[currentIndex + 1] === 0x00 &&
            fileData[currentIndex + 2] === 0x00 &&
            fileData[currentIndex + 3] === 0x01) {
            startCodeLength = 4;
        } else if (currentIndex + 3 <= fileData.length &&
            fileData[currentIndex] === 0x00 &&
            fileData[currentIndex + 1] === 0x00 &&
            fileData[currentIndex + 2] === 0x01) {
            startCodeLength = 3;
        }

        if (startCodeLength > 0) {
            // 找到下一个起始码
            let nextStartIndex = currentIndex + startCodeLength;
            while (nextStartIndex < fileData.length - 3) {
                if ((fileData[nextStartIndex] === 0x00 &&
                    fileData[nextStartIndex + 1] === 0x00 &&
                    fileData[nextStartIndex + 2] === 0x01) ||
                    (nextStartIndex < fileData.length - 4 &&
                        fileData[nextStartIndex] === 0x00 &&
                        fileData[nextStartIndex + 1] === 0x00 &&
                        fileData[nextStartIndex + 2] === 0x00 &&
                        fileData[nextStartIndex + 3] === 0x01)) {
                    break;
                }
                nextStartIndex++;
            }

            const naluLength = nextStartIndex - currentIndex;
            const naluData = fileData.slice(currentIndex, currentIndex + naluLength);
            const naluType = naluData[startCodeLength] & 0x1F;

            // 更新统计信息
            if (naluStats.hasOwnProperty(naluType)) {
                naluStats[naluType]++;
            }

            nalus.push({
                startIndex: currentIndex,
                length: naluLength,
                startCode: startCodeLength,
                type: naluType,
                data: naluData
            });

            currentIndex = nextStartIndex;
        } else {
            currentIndex++;
        }
    }

    currentNALUs = nalus;
    currentNALUIndex = 0;

    if (nalus.length > 0) {
        displayNALU(0);
        updateNALUStats(naluStats, nalus.length);
        updateNALUSequence(nalus);
    }
}

function displayNALU(index) {
    const nalu = currentNALUs[index];
    if (!nalu) return;

    // 显示加载指示器
    document.querySelectorAll('.loading-overlay').forEach(overlay => {
        overlay.classList.add('active');
    });

    // 使用 requestAnimationFrame 和 setTimeout 来确保加载指示器显示出来
    requestAnimationFrame(() => {
        setTimeout(() => {
            updateNALUInfo(nalu);
            displayHexView(nalu);
            updateNALUCounter();
            // 更新序列可视化中的选中状态
            updateSequenceSelection(index);

            // 隐藏加载指示器
            document.querySelectorAll('.loading-overlay').forEach(overlay => {
                overlay.classList.remove('active');
            });
        }, 0);
    });
}

function updateNALUInfo(nalu) {
    const naluInfo = document.getElementById('naluInfo');
    const naluType = NALU_TYPES[nalu.type];
    const sizeInBytes = nalu.length;

    let additionalInfo = '';
    
    // 如果是SPS NALU，解析更多详细信息
    if (nalu.type === 7) { // SPS
        const spsInfo = parseSPSData(nalu.data); // 使用新的解析函数
        if (spsInfo) {
            const profileName = getProfileName(spsInfo.profile_idc);
            
            // 格式化完整SPS信息为JSON字符串，并添加缩进
            const spsJsonString = JSON.stringify(spsInfo.rawSpsInfo, null, 2);
            
            additionalInfo = `
            <div class="nalu-details">
                <h4>SPS详细信息</h4>
                <div class="sps-details">
                    <div class="sps-detail-item">
                        <span class="sps-detail-label">Profile IDC:</span>
                        <span class="sps-detail-value">${spsInfo.profile_idc}</span>
                        <span class="sps-detail-desc">${profileName}</span>
                    </div>
                    <div class="sps-detail-item">
                        <span class="sps-detail-label">Level IDC:</span>
                        <span class="sps-detail-value">${spsInfo.level_idc}</span>
                        <span class="sps-detail-desc">Level ${spsInfo.level_idc}</span>
                    </div>
                    <div class="sps-detail-item">
                        <span class="sps-detail-label">Chroma Format:</span>
                        <span class="sps-detail-value">${spsInfo.chroma_format_idc}</span>
                        <span class="sps-detail-desc">${getChromaFormatName(spsInfo.chroma_format_idc)}</span>
                    </div>
                    <div class="sps-detail-item">
                        <span class="sps-detail-label">Bit Depth Luma:</span>
                        <span class="sps-detail-value">${spsInfo.bit_depth_luma}</span>
                        <span class="sps-detail-desc">位</span>
                    </div>
                    <div class="sps-detail-item">
                        <span class="sps-detail-label">Bit Depth Chroma:</span>
                        <span class="sps-detail-value">${spsInfo.bit_depth_chroma}</span>
                        <span class="sps-detail-desc">位</span>
                    </div>
                    <div class="sps-detail-item">
                        <span class="sps-detail-label">分辨率:</span>
                        <span class="sps-detail-value">${spsInfo.width}x${spsInfo.height}</span>
                    </div>
                </div>
                <div class="sps-json">
                    <h4>SPS完整解析结果</h4>
                    <pre>${spsJsonString}</pre>
                </div>
            </div>`;
        }
    }
    // 如果是PPS NALU，解析更多详细信息
    else if (nalu.type === 8) { // PPS
        const ppsInfo = parsePPSData(nalu.data);
        if (ppsInfo) {
            // 格式化完整PPS信息为JSON字符串，并添加缩进
            const ppsJsonString = JSON.stringify(ppsInfo.rawPpsInfo, null, 2);
            
            additionalInfo = `
            <div class="nalu-details">
                <h4>PPS详细信息</h4>
                <div class="sps-details">
                    <div class="sps-detail-item">
                        <span class="sps-detail-label">PPS ID:</span>
                        <span class="sps-detail-value">${ppsInfo.pps_id}</span>
                    </div>
                    <div class="sps-detail-item">
                        <span class="sps-detail-label">SPS ID:</span>
                        <span class="sps-detail-value">${ppsInfo.sps_id}</span>
                    </div>
                    <div class="sps-detail-item">
                        <span class="sps-detail-label">熵编码模式:</span>
                        <span class="sps-detail-value">${ppsInfo.entropy_coding_mode_flag ? 'CABAC' : 'CAVLC'}</span>
                    </div>
                    <div class="sps-detail-item">
                        <span class="sps-detail-label">片组数量:</span>
                        <span class="sps-detail-value">${ppsInfo.num_slice_groups}</span>
                    </div>
                    <div class="sps-detail-item">
                        <span class="sps-detail-label">加权预测标志:</span>
                        <span class="sps-detail-value">${ppsInfo.weighted_pred_flag ? '开启' : '关闭'}</span>
                    </div>
                    <div class="sps-detail-item">
                        <span class="sps-detail-label">初始量化参数:</span>
                        <span class="sps-detail-value">${ppsInfo.pic_init_qp}</span>
                    </div>
                    <div class="sps-detail-item">
                        <span class="sps-detail-label">去块滤波控制:</span>
                        <span class="sps-detail-value">${ppsInfo.deblocking_filter_control_present_flag ? '存在' : '不存在'}</span>
                    </div>
                    <div class="sps-detail-item">
                        <span class="sps-detail-label">变换8x8模式:</span>
                        <span class="sps-detail-value">${ppsInfo.transform_8x8_mode_flag ? '开启' : '关闭'}</span>
                    </div>
                </div>
                <div class="sps-json">
                    <h4>PPS完整解析结果</h4>
                    <pre>${ppsJsonString}</pre>
                </div>
            </div>`;
        }
    }

    naluInfo.innerHTML = `
        <div class="nalu-type" style="background-color: ${naluType?.color || 'var(--dark-color)'}">
            ${naluType?.name || '未知类型'}<span class="nalu-type-value">${nalu.type}</span>
            <div class="nalu-type-description">
                ${naluType?.description || ''}
            </div>
        </div>
        <div class="nalu-stat">
            <div class="nalu-stat-item">
                <div class="nalu-stat-label">数据大小</div>
                <div class="nalu-stat-value">${sizeInBytes} 字节</div>
            </div>
            <div class="nalu-stat-item">
                <div class="nalu-stat-label">起始码长度</div>
                <div class="nalu-stat-value">${nalu.startCode} 字节</div>
            </div>
        </div>
        <div class="nalu-details-secondary">
            起始位置: 0x${nalu.startIndex.toString(16)}
        </div>
        ${additionalInfo}
    `;
}

function updateNALUCounter() {
    const counter = document.getElementById('naluCounter');
    counter.textContent = `${currentNALUIndex + 1}/${currentNALUs.length}`;
}

// 十六进制查看器相关函数
function displayHexView(nalu) {
    const hexContent = document.getElementById('hexContent');
    if (!hexContent) return;

    hexContent.innerHTML = '';
    const data = nalu.data;

    for (let i = 0; i < data.length; i += 16) {
        const rowDiv = createHexRow(data, i, nalu);
        hexContent.appendChild(rowDiv);
    }

    setupHexViewTooltips(hexContent);
}

function createHexRow(data, offset, nalu) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'hex-row';

    // 添加偏移量
    const offsetSpan = document.createElement('span');
    offsetSpan.className = 'hex-offset';
    offsetSpan.textContent = offset.toString(16).padStart(8, '0');
    rowDiv.appendChild(offsetSpan);

    // 添加十六进制字节
    const bytesDiv = document.createElement('div');
    bytesDiv.className = 'hex-bytes';

    // 创建16个字节位置
    const asciiChars = [];
    for (let j = 0; j < 16; j++) {
        const byteSpan = document.createElement('span');
        byteSpan.className = 'hex-byte';

        if (offset + j < data.length) {
            const byte = data[offset + j];
            const isStartCode = offset + j < nalu.startCode;
            const isNaluType = offset + j === nalu.startCode;

            byteSpan.textContent = byte.toString(16).padStart(2, '0');
            // 添加二进制属性
            byteSpan.setAttribute('data-binary', byte.toString(2).padStart(8, '0'));
            byteSpan.setAttribute('data-hex', byte.toString(16).padStart(2, '0'));

            if (isStartCode) {
                byteSpan.classList.add('start-code');
                byteSpan.setAttribute('data-tooltip', '起始码');
            } else if (isNaluType) {
                byteSpan.classList.add('nalu-header');
                const naluTypeValue = byte & 0x1F;
                const naluType = NALU_TYPES[naluTypeValue];
                byteSpan.style.backgroundColor = naluType?.color || 'var(--dark-color)';
                const hexType = HEX_NALU_TYPES[naluTypeValue] || '未知';
                byteSpan.setAttribute('data-tooltip', `NALU: ${hexType}`);
            }

            // 收集ASCII字符
            asciiChars.push(byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.');
        } else {
            byteSpan.textContent = '  ';
            asciiChars.push(' ');
        }
        bytesDiv.appendChild(byteSpan);
    }
    rowDiv.appendChild(bytesDiv);

    // 添加ASCII表示
    const asciiDiv = document.createElement('div');
    asciiDiv.className = 'hex-ascii';
    asciiDiv.textContent = asciiChars.join('');
    rowDiv.appendChild(asciiDiv);

    return rowDiv;
}

function setupHexViewTooltips(hexContent) {
    const tooltip = document.createElement('div');
    tooltip.className = 'hex-byte-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);

    hexContent.addEventListener('mouseover', (e) => {
        const target = e.target;
        if (target.classList.contains('hex-byte') && target.textContent.trim() !== '') {
            // 获取十六进制和二进制值
            const hexValue = target.getAttribute('data-hex') || target.textContent.trim();
            const binaryValue = target.getAttribute('data-binary') || '';
            // 组合显示信息
            let tooltipContent = '';
            
            if (target.hasAttribute('data-tooltip')) {
                tooltipContent = target.getAttribute('data-tooltip') + '<br>';
            }
            
            if (binaryValue) {
                tooltipContent += `二进制: ${binaryValue}<br>十六进制: ${hexValue}`;
            } else {
                tooltipContent = target.getAttribute('data-tooltip') || '';
            }
            
            tooltip.innerHTML = tooltipContent;
            tooltip.style.display = 'block';

            // 使用鼠标位置而不是元素位置
            updateTooltipPosition(e, tooltip);
        }
    });

    // 当鼠标在hex-byte上移动时，更新tooltip位置
    hexContent.addEventListener('mousemove', (e) => {
        if (tooltip.style.display === 'block') {
            updateTooltipPosition(e, tooltip);
        }
    });

    hexContent.addEventListener('mouseout', () => {
        tooltip.style.display = 'none';
    });

    // 更新工具提示位置
    document.addEventListener('scroll', () => {
        tooltip.style.display = 'none';
    }, true);
    
    // 辅助函数：根据鼠标位置更新tooltip位置
    function updateTooltipPosition(e, tooltip) {
        const offset = 15; // 鼠标和tooltip之间的偏移量
        
        // 获取鼠标位置
        const x = e.clientX;
        const y = e.clientY;
        
        // 设置tooltip位置（在鼠标右上方）
        tooltip.style.left = (x + offset) + 'px';
        tooltip.style.top = (y - tooltip.offsetHeight - 5) + 'px';
        
        // 检查是否超出右侧边界
        const rightEdge = window.innerWidth - tooltip.offsetWidth - 10;
        if (parseInt(tooltip.style.left) > rightEdge) {
            tooltip.style.left = (x - tooltip.offsetWidth - offset) + 'px';
        }
        
        // 检查是否超出顶部边界
        if (parseInt(tooltip.style.top) < 10) {
            tooltip.style.top = (y + offset) + 'px';
        }
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function updateNALUStats(stats, totalCount) {
    const statsContent = document.getElementById('naluStatsContent');
    const sequencePanel = document.getElementById('naluSequencePanel');

    sequencePanel.style.display = 'block';
    statsContent.innerHTML = '';

    Object.entries(stats).forEach(([type, count]) => {
        if (count > 0) {
            const naluType = NALU_TYPES[type];
            const percent = ((count / totalCount) * 100).toFixed(1);

            const card = document.createElement('div');
            card.className = 'nalu-stat-card';
            card.innerHTML = `
                <div class="nalu-stat-card-header">
                    <div class="nalu-stat-card-color" style="background-color: ${naluType.color}"></div>
                    <div class="nalu-stat-card-title">${naluType.name}</div>
                </div>
                <div class="nalu-stat-card-count">${count}</div>
                <div class="nalu-stat-card-percent">${percent}%</div>
            `;
            statsContent.appendChild(card);
        }
    });
}

function updateNALUSequence(nalus) {
    const sequencePanel = document.getElementById('naluSequencePanel');
    const sequenceContent = document.getElementById('naluSequenceContent');
    const avgIdrInterval = document.getElementById('avgIdrInterval');
    const sizeToggle = document.getElementById('sizeToggle');

    sequencePanel.style.display = 'block';
    sequenceContent.innerHTML = '';

    // 根据开关状态设置容器高度
    sequenceContent.style.setProperty('--content-height',
        sizeToggle.checked ? '100px' : '40px'
    );

    // 创建刻度尺
    const scaleDiv = document.createElement('div');
    scaleDiv.className = 'nalu-sequence-scale';

    // 计算NALU大小范围
    const maxSize = Math.max(...nalus.map(nalu => nalu.length));
    const minSize = Math.min(...nalus.map(nalu => nalu.length));

    // 创建刻度线
    const scalePoints = [
        { value: maxSize, label: formatBytes(maxSize) },
        { value: Math.floor((maxSize + minSize) / 2), label: formatBytes(Math.floor((maxSize + minSize) / 2)) },
        { value: minSize, label: formatBytes(minSize) }
    ];

    scalePoints.forEach(point => {
        const scaleLine = document.createElement('div');
        scaleLine.className = 'nalu-sequence-scale-line';
        scaleLine.textContent = point.label;
        scaleDiv.appendChild(scaleLine);
    });

    if (sizeToggle.checked) {
        sequenceContent.appendChild(scaleDiv);
    }

    // 创建单个固定的tooltip元素
    let tooltip = document.querySelector('.nalu-sequence-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'nalu-sequence-tooltip';
        document.body.appendChild(tooltip);
    }

    // 计算IDR间隔
    let lastIdrIndex = -1;
    let totalInterval = 0;
    let intervalCount = 0;
    let idrPositions = [];

    nalus.forEach((nalu, index) => {
        if (nalu.type === 5) { // IDR帧
            if (lastIdrIndex !== -1) {
                const interval = index - lastIdrIndex;
                totalInterval += interval;
                intervalCount++;
            }
            lastIdrIndex = index;
            idrPositions.push(index);
        }
    });

    // 更新平均IDR间隔
    const avgInterval = intervalCount > 0 ? (totalInterval / intervalCount).toFixed(1) : '-';
    avgIdrInterval.textContent = avgInterval;

    // 计算高度比例
    const minHeight = 12; // 最小高度
    const maxHeight = 60; // 最大高度
    const heightScale = (maxHeight - minHeight) / (maxSize - minSize || 1);

    // 创建序列可视化
    nalus.forEach((nalu, index) => {
        const naluType = NALU_TYPES[nalu.type];
        const item = document.createElement('div');
        item.className = 'nalu-sequence-item';
        item.style.backgroundColor = naluType?.color || 'var(--dark-color)';

        // 根据开关状态设置高度
        if (sizeToggle.checked) {
            const height = minHeight + (nalu.length - minSize) * heightScale;
            item.style.setProperty('--item-height', `${height}px`);
        } else {
            item.style.setProperty('--item-height', `${minHeight}px`);
        }

        // 添加提示信息
        item.setAttribute('data-index', index);
        item.setAttribute('data-type', naluType?.name || '未知');
        item.setAttribute('data-size', nalu.length);

        // 点击事件
        item.addEventListener('click', () => {
            currentNALUIndex = index;
            displayNALU(index);
            // 更新选中状态
            document.querySelectorAll('.nalu-sequence-item').forEach(item => {
                item.classList.remove('selected');
            });
            item.classList.add('selected');
            // 隐藏tooltip
            tooltip.style.display = 'none';
        });

        // 悬停提示
        item.addEventListener('mouseover', (e) => {
            tooltip.textContent = `${naluType?.name || '未知'} (${nalu.length} 字节)`;

            const rect = e.target.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            tooltip.style.left = (rect.left + scrollLeft) + 'px';
            tooltip.style.top = (rect.bottom + scrollTop + 5) + 'px';
            tooltip.style.display = 'block';
        });

        item.addEventListener('mouseout', () => {
            tooltip.style.display = 'none';
        });

        sequenceContent.appendChild(item);
    });

    // 标记当前选中的NALU
    if (currentNALUIndex >= 0) {
        const items = sequenceContent.querySelectorAll('.nalu-sequence-item');
        items[currentNALUIndex]?.classList.add('selected');
    }

    // 添加全局滚动监听
    const handleScroll = () => {
        tooltip.style.display = 'none';
    };

    // 移除旧的滚动监听器（如果存在）
    window.removeEventListener('scroll', handleScroll);
    // 添加新的滚动监听器
    window.addEventListener('scroll', handleScroll);
}

// 事件监听设置
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const uploadSection = document.getElementById('uploadSection');
    const clearFileButton = document.getElementById('clearFile');

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFile(file);
        }
    });

    uploadSection.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadSection.classList.add('drag-over');
    });

    uploadSection.addEventListener('dragleave', () => {
        uploadSection.classList.remove('drag-over');
    });

    uploadSection.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadSection.classList.remove('drag-over');

        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    clearFileButton.addEventListener('click', clearFile);

    document.getElementById('prevNalu').addEventListener('click', () => {
        if (currentNALUIndex > 0) {
            currentNALUIndex--;
            displayNALU(currentNALUIndex);
            // 更新序列可视化中的选中状态
            updateSequenceSelection(currentNALUIndex);
        }
    });

    document.getElementById('nextNalu').addEventListener('click', () => {
        if (currentNALUIndex < currentNALUs.length - 1) {
            currentNALUIndex++;
            displayNALU(currentNALUIndex);
            // 更新序列可视化中的选中状态
            updateSequenceSelection(currentNALUIndex);
        }
    });

    // 添加大小显示开关事件监听
    document.getElementById('sizeToggle').addEventListener('change', (e) => {
        if (currentNALUs.length > 0) {
            updateNALUSequence(currentNALUs);
        }
    });
});

// 添加新的辅助函数来更新序列选中状态
function updateSequenceSelection(index) {
    const items = document.querySelectorAll('.nalu-sequence-item');
    items.forEach(item => item.classList.remove('selected'));
    items[index]?.classList.add('selected');

    // 确保选中的项目可见（滚动到视图中）
    const selectedItem = items[index];
    if (selectedItem) {
        const container = document.getElementById('naluSequenceContent');
        const itemRect = selectedItem.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        if (itemRect.left < containerRect.left || itemRect.right > containerRect.right) {
            selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }
}

// 添加加载示例文件的函数
async function loadSampleFile() {
    const url = './assets/origin30s.h264';  // 替换为您的服务器域名
    try {
        // 显示加载指示器
        document.querySelectorAll('.loading-overlay').forEach(overlay => {
            overlay.classList.add('active');
        });

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        fileData = new Uint8Array(buffer);

        // 更新UI显示
        document.querySelector('.file-name').textContent = 'origin30s.h264';
        document.querySelector('.file-size').textContent = formatFileSize(buffer.byteLength);
        document.querySelector('.file-info').style.display = 'block';
        document.getElementById('clearFile').style.display = 'inline-block';
        document.getElementById('uploadSection').classList.add('has-file');

        // 处理文件
        processH264File();

        // 隐藏加载指示器
        document.querySelectorAll('.loading-overlay').forEach(overlay => {
            overlay.classList.remove('active');
        });
    } catch (error) {
        console.error('加载示例文件失败:', error);
        alert('加载示例文件失败: ' + error.message);
        // 隐藏加载指示器
        document.querySelectorAll('.loading-overlay').forEach(overlay => {
            overlay.classList.remove('active');
        });
    }
}

// 将loadSampleFile添加到全局作用域，使其可以从HTML中访问
window.loadSampleFile = loadSampleFile;

// 使用sps-pps库解析SPS数据
function parseSPSData(data) {
    try {
        // 跳过起始码
        const startCodeLength = data[0] === 0 && data[1] === 0 && data[2] === 0 && data[3] === 1 ? 4 :
                               data[0] === 0 && data[1] === 0 && data[2] === 1 ? 3 : 0;
        
        if (startCodeLength === 0) {
            console.error('无效的NALU数据：找不到起始码');
            return null;
        }
        
        // 提取不包含起始码的NALU数据
        const naluData = data.slice(startCodeLength);
        
        // 验证NALU类型
        const naluType = naluData[0] & 0x1F;
        if (naluType !== 7) {
            console.error(`无效的NALU类型：${naluType}，期望SPS(7)`);
            return null;
        }
        
        // 调用解析函数，传入不包含起始码的NALU
        const spsInfo = spsPpsParser.parseSPS(naluData);
        
        // 计算分辨率
        const pic_width_in_mbs = spsInfo.pic_width_in_mbs;
        const pic_height_in_map_units = spsInfo.pic_height_in_map_units;
        
        // 初始宽高
        let width = pic_width_in_mbs * 16;
        let height = pic_height_in_map_units * 16;
        
        // 如果不是帧编码模式，高度需要乘以2
        if (!spsInfo.frame_mbs_only_flag) {
            height *= 2;
        }
        
        // 应用裁剪参数
        if (spsInfo.frame_cropping_flag) {
            // 根据色度采样格式设置裁剪单位
            let cropUnitX = 1;
            let cropUnitY = 1;
            
            if (spsInfo.chroma_format_idc === 0) {
                // 单色
                cropUnitX = 1;
                cropUnitY = 1;
            } else {
                // 4:2:0, 4:2:2, 4:4:4 等
                cropUnitX = spsInfo.chroma_format_idc === 3 ? 1 : 2;
                cropUnitY = spsInfo.chroma_format_idc === 1 ? 2 : 1;
            }
            
            if (!spsInfo.frame_mbs_only_flag) {
                // 场编码时，垂直裁剪单位需要调整
                cropUnitY *= 2;
            }
            
            width -= (spsInfo.frame_cropping.left + spsInfo.frame_cropping.right) * cropUnitX;
            height -= (spsInfo.frame_cropping.top + spsInfo.frame_cropping.bottom) * cropUnitY;
        }
        
        // 返回解析后的结果，同时包含计算的分辨率和完整的SPS信息
        return {
            profile_idc: spsInfo.profile_idc,
            level_idc: spsInfo.level_idc / 10, // 转换为常见表示形式
            chroma_format_idc: spsInfo.chroma_format_idc,
            bit_depth_luma: spsInfo.bit_depth_luma,
            bit_depth_chroma: spsInfo.bit_depth_chroma,
            width: width,
            height: height,
            // 存储完整的SPS解析结果
            rawSpsInfo: spsInfo
        };
    } catch (e) {
        console.error('SPS解析错误:', e);
        return null;
    }
}

// 使用sps-pps库解析PPS数据
function parsePPSData(data) {
    try {
        // 跳过起始码
        const startCodeLength = data[0] === 0 && data[1] === 0 && data[2] === 0 && data[3] === 1 ? 4 :
                               data[0] === 0 && data[1] === 0 && data[2] === 1 ? 3 : 0;
        
        if (startCodeLength === 0) {
            console.error('无效的NALU数据：找不到起始码');
            return null;
        }
        
        // 提取不包含起始码的NALU数据
        const naluData = data.slice(startCodeLength);
        
        // 验证NALU类型
        const naluType = naluData[0] & 0x1F;
        if (naluType !== 8) {
            console.error(`无效的NALU类型：${naluType}，期望PPS(8)`);
            return null;
        }
        
        // PPS解析需要SPS的信息，获取当前所有的SPS NALU
        const spsMap = new Map();
        for (const nalu of currentNALUs) {
            if (nalu.type === 7) { // 找到SPS
                try {
                    const spsNaluData = nalu.data.slice(nalu.startCode);
                    const spsInfo = spsPpsParser.parseSPS(spsNaluData);
                    spsMap.set(spsInfo.sps_id, spsInfo);
                } catch (e) {
                    console.error('解析SPS失败:', e);
                }
            }
        }
        
        // 调用解析函数，传入不包含起始码的NALU和SPS映射
        const ppsInfo = spsPpsParser.parsePPS(naluData, spsMap);
        
        // 返回解析后的结果
        return {
            pps_id: ppsInfo.pps_id,
            sps_id: ppsInfo.sps_id,
            entropy_coding_mode_flag: ppsInfo.entropy_coding_mode_flag,
            bottom_field_pic_order_in_frame_present_flag: ppsInfo.bottom_field_pic_order_in_frame_present_flag,
            num_slice_groups: ppsInfo.num_slice_groups,
            weighted_pred_flag: ppsInfo.weighted_pred_flag,
            weighted_bipred_idc: ppsInfo.weighted_bipred_idc,
            pic_init_qp: ppsInfo.pic_init_qp,
            deblocking_filter_control_present_flag: ppsInfo.deblocking_filter_control_present_flag,
            constrained_intra_pred_flag: ppsInfo.constrained_intra_pred_flag,
            redundant_pic_cnt_present_flag: ppsInfo.redundant_pic_cnt_present_flag,
            transform_8x8_mode_flag: ppsInfo.transform_8x8_mode_flag,
            pic_scaling_matrix_present_flag: ppsInfo.pic_scaling_matrix_present_flag,
            // 存储完整的PPS解析结果
            rawPpsInfo: ppsInfo
        };
    } catch (e) {
        console.error('PPS解析错误:', e);
        return null;
    }
}

// 获取色度采样格式描述
function getChromaFormatName(chroma_format_idc) {
    switch (chroma_format_idc) {
        case 0: return '单色';
        case 1: return '4:2:0';
        case 2: return '4:2:2';
        case 3: return '4:4:4';
        default: return '未知';
    }
}

// ExpGolomb解码器 - 用于解析H.264比特流
class ExpGolombDecoder {
    constructor(data) {
        this.data = data;
        this.bytesAvailable = data.length;
        this.bytePos = 0;
        this.bitPos = 0;
        this.curByte = 0;
    }
    
    readBits(size) {
        let result = 0;
        let bitsConsumed = 0;
        let bitsLeft = size;
        
        // 读取已缓存的位
        if (this.bitPos > 0) {
            const readSize = Math.min(this.bitPos, bitsLeft);
            const maskSize = Math.pow(2, readSize) - 1;
            const mask = maskSize << (this.bitPos - readSize);
            result = (this.curByte & mask) >> (this.bitPos - readSize);
            this.bitPos -= readSize;
            bitsConsumed = readSize;
            bitsLeft -= readSize;
        }
        
        // 按字节处理剩余位
        while (bitsLeft > 0 && this.bytePos < this.bytesAvailable) {
            // 获取下一个字节
            if (this.bitPos === 0) {
                this.curByte = this.data[this.bytePos];
                this.bytePos++;
                this.bitPos = 8;
            }
            
            const readSize = Math.min(this.bitPos, bitsLeft);
            const maskSize = Math.pow(2, readSize) - 1;
            const mask = maskSize << (this.bitPos - readSize);
            const newBits = (this.curByte & mask) >> (this.bitPos - readSize);
            
            result = (result << readSize) | newBits;
            this.bitPos -= readSize;
            bitsConsumed += readSize;
            bitsLeft -= readSize;
        }
        
        return result;
    }
    
    skipBits(size) {
        let bitsLeft = size;
        
        // 跳过已缓存的位
        if (this.bitPos > 0) {
            const skipSize = Math.min(this.bitPos, bitsLeft);
            this.bitPos -= skipSize;
            bitsLeft -= skipSize;
        }
        
        // 按字节跳过剩余位
        const bytesToSkip = Math.floor(bitsLeft / 8);
        if (bytesToSkip > 0) {
            this.bytePos += bytesToSkip;
            bitsLeft -= bytesToSkip * 8;
        }
        
        // 处理剩余位
        if (bitsLeft > 0 && this.bytePos < this.bytesAvailable) {
            this.curByte = this.data[this.bytePos];
            this.bytePos++;
            this.bitPos = 8 - bitsLeft;
        }
    }
    
    // 读取无符号指数哥伦布编码值
    readUEG() {
        let zeroBits = 0;
        
        // 计算前导零的个数
        while (this.bytePos < this.bytesAvailable) {
            if (this.bitPos === 0) {
                this.curByte = this.data[this.bytePos];
                this.bytePos++;
                this.bitPos = 8;
            }
            
            if ((this.curByte & (0x80 >> (8 - this.bitPos))) !== 0) {
                // 遇到1，结束前导零的计数
                break;
            }
            
            zeroBits++;
            this.bitPos--;
            
            if (this.bitPos === 0) {
                // 移动到下一个字节
                this.curByte = 0;
            }
        }
        
        // 跳过标记位1
        this.bitPos--;
        
        if (zeroBits === 0) {
            return 0;
        }
        
        // 读取剩余的比特
        let result = this.readBits(zeroBits);
        result += Math.pow(2, zeroBits) - 1;
        
        return result;
    }
    
    // 读取有符号指数哥伦布编码值
    readSEG() {
        const value = this.readUEG();
        if (value & 0x01) {
            // 奇数为正数
            return (value + 1) >> 1;
        } else {
            // 偶数为负数
            return -1 * (value >> 1);
        }
    }
}

// 获取Profile名称
function getProfileName(profile_idc) {
    switch (profile_idc) {
        case 66: return 'Baseline Profile';
        case 77: return 'Main Profile';
        case 88: return 'Extended Profile';
        case 100: return 'High Profile';
        case 110: return 'High 10 Profile';
        case 122: return 'High 4:2:2 Profile';
        case 244: return 'High 4:4:4 Profile';
        case 44: return 'CAVLC 4:4:4 Profile';
        case 83: return 'Scalable Baseline Profile';
        case 86: return 'Scalable High Profile';
        case 118: return 'Stereo High Profile';
        case 128: return 'Multiview High Profile';
        case 138: return 'Multiview Depth High Profile';
        case 139: return 'Enhanced Multiview Depth High Profile';
        default: return '未知 Profile';
    }
}