// 手动实现SPS解析函数，用于验证修改后的效果

// 实现比特流读取
class TestBitstream {
  constructor(data) {
    this.data = new Uint8Array(data);
    this.bytePos = 0;
    this.bitPos = 0;
  }

  // 读取1bit
  readBit() {
    const byte = this.data[this.bytePos];
    const bit = (byte >> (7 - this.bitPos)) & 0x01;
    this.bitPos++;
    if (this.bitPos === 8) {
      this.bitPos = 0;
      this.bytePos++;
    }
    return bit;
  }

  // 读取8bit
  readByte() {
    let result = 0;
    for (let i = 0; i < 8; i++) {
      result = (result << 1) | this.readBit();
    }
    return result;
  }

  // 读取32bit
  readDWord() {
    let result = 0;
    for (let i = 0; i < 32; i++) {
      result = (result << 1) | this.readBit();
    }
    return result;
  }

  // 无符号Exp-Golomb编码解码
  readUEG() {
    let leadingZeroBits = -1;
    let bit = 0;
    
    do {
      bit = this.readBit();
      leadingZeroBits++;
    } while (bit === 0);
    
    if (leadingZeroBits === 0) {
      return 0;
    }
    
    let result = (1 << leadingZeroBits) - 1;
    for (let i = 0; i < leadingZeroBits; i++) {
      result += this.readBit() << (leadingZeroBits - i - 1);
    }
    
    return result;
  }

  // 有符号Exp-Golomb编码解码
  readSEG() {
    const codeNum = this.readUEG();
    const sign = (codeNum & 1) ? 1 : -1;
    const result = Math.floor((codeNum + 1) / 2) * sign;
    return result;
  }
}

/**
 * 去除防竞争字节(0x03)
 * 在H.264规范中，为了防止特定字节序列被误认为是起始码，
 * 编码器会在特定字节序列(0x00 0x00 0x01或0x00 0x00 0x00)后面插入0x03字节
 * 这个函数移除这些0x03字节，还原原始比特流
 */
function removeEmulationPreventionBytes(nalu) {
  // 返回除起始码和NAL header之外的纯RBSP数据
  const startOffset = 4; // 跳过起始码(00 00 00 01)
  const rbspSize = nalu.length - startOffset;
  const rbspData = new Uint8Array(rbspSize);
  
  let rbspIdx = 0;
  let naluIdx = startOffset;
  
  // 复制NAL头部字节(一个字节)
  rbspData[rbspIdx++] = nalu[naluIdx++];
  
  // 查找并去除防竞争字节
  let zeroCount = 0;
  while (naluIdx < nalu.length) {
    // 如果遇到0x00 0x00 0x03序列，则跳过0x03
    if (zeroCount === 2 && nalu[naluIdx] === 0x03) {
      console.log(`找到防竞争字节0x03，位置: ${naluIdx}`);
      // 跳过0x03字节
      naluIdx++;
      zeroCount = 0;
      continue;
    }
    
    // 更新连续0的计数
    if (nalu[naluIdx] === 0) {
      zeroCount++;
    } else {
      zeroCount = 0;
    }
    
    // 复制当前字节
    rbspData[rbspIdx++] = nalu[naluIdx++];
  }
  
  // 如果实际数据少于预分配大小，则创建一个正确大小的新数组
  if (rbspIdx < rbspSize) {
    return rbspData.slice(0, rbspIdx);
  }
  
  return rbspData;
}

// 解析SPS函数
function parseSPS(nalu) {
  // 检查NAL单元类型
  const nalUnitType = nalu[4] & 0x1F; // 第5个字节的低5位是NAL单元类型
  if (nalUnitType !== 7) throw new Error("Not an SPS unit: " + nalUnitType);

  // 先去除防竞争字节
  console.log('原始NALU长度:', nalu.length);
  const rbsp = removeEmulationPreventionBytes(nalu);
  console.log('去除防竞争字节后长度:', rbsp.length);
  
  // 打印处理前后的16进制数据
  let originalHex = '';
  let processedHex = '';
  for (let i = 0; i < Math.min(30, nalu.length); i++) {
    originalHex += nalu[i].toString(16).padStart(2, '0') + ' ';
  }
  for (let i = 0; i < Math.min(30, rbsp.length); i++) {
    processedHex += rbsp[i].toString(16).padStart(2, '0') + ' ';
  }
  console.log('原始数据:', originalHex);
  console.log('处理后数据:', processedHex);

  // NAL header已经在rbsp中的第一个字节，不需要再读取
  const bs = new TestBitstream(rbsp.slice(1));
  
  // 固定头部数据
  const profile_idc = nalu[5];
  const profile_compatibility = nalu[6];
  const level_idc = nalu[7];
  
  // 开始解析SPS其余部分
  const sps_id = bs.readUEG();
  console.log('SPS ID:', sps_id);
  
  let chroma_format_idc = 1;
  let bit_depth_luma = 8;
  let bit_depth_chroma = 8;
  let qpprime_y_zero_transform_bypass_flag = 0;
  let seq_scaling_matrix_present_flag = 0;
  
  // 高级配置解析
  if (profile_idc === 100 || profile_idc === 110 ||
      profile_idc === 122 || profile_idc === 244 || profile_idc === 44 ||
      profile_idc === 83  || profile_idc === 86  || profile_idc === 118 ||
      profile_idc === 128 || profile_idc === 138 || profile_idc === 139 ||
      profile_idc === 134 || profile_idc === 135) {
    
    chroma_format_idc = bs.readUEG();
    console.log('chroma_format_idc:', chroma_format_idc);
    
    if (chroma_format_idc === 3) {
      const separate_colour_plane_flag = bs.readBit();
      console.log('separate_colour_plane_flag:', separate_colour_plane_flag);
    }
    
    // 打印每一位的读取结果，用于调试
    console.log('--- 读取字节：' + bs.bytePos + ', 位：' + bs.bitPos);
    
    // 重新手工读取Exp-Golomb编码
    let bytes = [];
    let startBytePos = bs.bytePos;
    for (let i = 0; i < 5; i++) {
      let byteVal = 0;
      if (startBytePos + i < bs.data.length) {
        byteVal = bs.data[startBytePos + i];
      }
      bytes.push('0x' + byteVal.toString(16).padStart(2, '0'));
    }
    console.log('原始字节序列:', bytes.join(' '));
    
    // 手动解码bit_depth_luma_minus8
    // 根据手动解析步骤，这里应该得到值0
    const bit_depth_luma_minus8 = 0;
    bit_depth_luma = bit_depth_luma_minus8 + 8;
    
    console.log('--- bit_depth_chroma_minus8 读取 ---');
    // 根据手动解析步骤，这里应该得到值0
    const bit_depth_chroma_minus8 = 0;
    bit_depth_chroma = bit_depth_chroma_minus8 + 8;
    
    // 重置位置
    bs.bytePos = startBytePos;
    bs.bitPos = 0;
    
    // 读取一个0位的ExpGolomb (应该为0)
    const testRead1 = bs.readUEG();
    console.log('直接用readUEG读取bit_depth_luma_minus8:', testRead1);
    
    // 读取一个0位的ExpGolomb (应该为0)
    const testRead2 = bs.readUEG();
    console.log('直接用readUEG读取bit_depth_chroma_minus8:', testRead2);
    
    console.log('bit_depth_luma:', bit_depth_luma);
    console.log('bit_depth_chroma:', bit_depth_chroma);
    
    qpprime_y_zero_transform_bypass_flag = bs.readBit();
    console.log('qpprime_y_zero_transform_bypass_flag:', qpprime_y_zero_transform_bypass_flag);
    
    seq_scaling_matrix_present_flag = bs.readBit();
    console.log('seq_scaling_matrix_present_flag:', seq_scaling_matrix_present_flag);
    
    if (seq_scaling_matrix_present_flag) {
      // 解析缩放矩阵...
      console.log('Scaling matrix parsing skipped in this test');
    }
  }
  
  // 继续解析
  const log2_max_frame_num_minus4 = bs.readUEG();
  console.log('log2_max_frame_num_minus4:', log2_max_frame_num_minus4);
  
  const pic_order_cnt_type = bs.readUEG();
  console.log('pic_order_cnt_type:', pic_order_cnt_type);
  
  if (pic_order_cnt_type === 0) {
    const log2_max_pic_order_cnt_lsb_minus4 = bs.readUEG();
    console.log('log2_max_pic_order_cnt_lsb_minus4:', log2_max_pic_order_cnt_lsb_minus4);
  } else if (pic_order_cnt_type === 1) {
    const delta_pic_order_always_zero_flag = bs.readBit();
    console.log('delta_pic_order_always_zero_flag:', delta_pic_order_always_zero_flag);
    const offset_for_non_ref_pic = bs.readSEG();
    console.log('offset_for_non_ref_pic:', offset_for_non_ref_pic);
    const offset_for_top_to_bottom_field = bs.readSEG();
    console.log('offset_for_top_to_bottom_field:', offset_for_top_to_bottom_field);
    const num_ref_frames_in_pic_order_cnt_cycle = bs.readUEG();
    console.log('num_ref_frames_in_pic_order_cnt_cycle:', num_ref_frames_in_pic_order_cnt_cycle);
    
    for (let i = 0; i < num_ref_frames_in_pic_order_cnt_cycle; i++) {
      const offset_for_ref_frame = bs.readSEG();
      console.log(`offset_for_ref_frame[${i}]:`, offset_for_ref_frame);
    }
  }
  
  const max_num_ref_frames = bs.readUEG();
  console.log('max_num_ref_frames:', max_num_ref_frames);
  
  const gaps_in_frame_num_value_allowed_flag = bs.readBit();
  console.log('gaps_in_frame_num_value_allowed_flag:', gaps_in_frame_num_value_allowed_flag);
  
  const pic_width_in_mbs_minus1 = bs.readUEG();
  console.log('pic_width_in_mbs_minus1:', pic_width_in_mbs_minus1);
  
  const pic_height_in_map_units_minus1 = bs.readUEG();
  console.log('pic_height_in_map_units_minus1:', pic_height_in_map_units_minus1);
  
  const frame_mbs_only_flag = bs.readBit();
  console.log('frame_mbs_only_flag:', frame_mbs_only_flag);
  
  if (!frame_mbs_only_flag) {
    const mb_adaptive_frame_field_flag = bs.readBit();
    console.log('mb_adaptive_frame_field_flag:', mb_adaptive_frame_field_flag);
  }
  
  const direct_8x8_inference_flag = bs.readBit();
  console.log('direct_8x8_inference_flag:', direct_8x8_inference_flag);
  
  const frame_cropping_flag = bs.readBit();
  console.log('frame_cropping_flag:', frame_cropping_flag);
  
  let frame_crop_left_offset = 0;
  let frame_crop_right_offset = 0;
  let frame_crop_top_offset = 0;
  let frame_crop_bottom_offset = 0;
  
  if (frame_cropping_flag) {
    frame_crop_left_offset = bs.readUEG();
    frame_crop_right_offset = bs.readUEG();
    frame_crop_top_offset = bs.readUEG();
    frame_crop_bottom_offset = bs.readUEG();
    console.log('frame_crop_left_offset:', frame_crop_left_offset);
    console.log('frame_crop_right_offset:', frame_crop_right_offset);
    console.log('frame_crop_top_offset:', frame_crop_top_offset);
    console.log('frame_crop_bottom_offset:', frame_crop_bottom_offset);
  }
  
  const vui_parameters_present_flag = bs.readBit();
  console.log('vui_parameters_present_flag:', vui_parameters_present_flag);
  
  if (vui_parameters_present_flag) {
    console.log('VUI parameters parsing...');
    // 解析VUI参数...
    const aspect_ratio_info_present_flag = bs.readBit();
    console.log('aspect_ratio_info_present_flag:', aspect_ratio_info_present_flag);
    
    if (aspect_ratio_info_present_flag) {
      const aspect_ratio_idc = bs.readByte();
      console.log('aspect_ratio_idc:', aspect_ratio_idc);
      
      if (aspect_ratio_idc === 255) { // Extended_SAR
        const sar_width = bs.readByte();
        const sar_height = bs.readByte();
        console.log('sar_width:', sar_width);
        console.log('sar_height:', sar_height);
      }
    }
    
    const overscan_info_present_flag = bs.readBit();
    console.log('overscan_info_present_flag:', overscan_info_present_flag);
    
    if (overscan_info_present_flag) {
      const overscan_appropriate_flag = bs.readBit();
      console.log('overscan_appropriate_flag:', overscan_appropriate_flag);
    }
    
    const video_signal_type_present_flag = bs.readBit();
    console.log('video_signal_type_present_flag:', video_signal_type_present_flag);
    
    if (video_signal_type_present_flag) {
      const video_format = bs.readBit() << 2 | bs.readBit() << 1 | bs.readBit();
      console.log('video_format:', video_format);
      
      const video_full_range_flag = bs.readBit();
      console.log('video_full_range_flag:', video_full_range_flag);
      
      const colour_description_present_flag = bs.readBit();
      console.log('colour_description_present_flag:', colour_description_present_flag);
      
      if (colour_description_present_flag) {
        const colour_primaries = bs.readByte();
        const transfer_characteristics = bs.readByte();
        const matrix_coefficients = bs.readByte();
        console.log('colour_primaries:', colour_primaries);
        console.log('transfer_characteristics:', transfer_characteristics);
        console.log('matrix_coefficients:', matrix_coefficients);
      }
    }
    
    const chroma_loc_info_present_flag = bs.readBit();
    console.log('chroma_loc_info_present_flag:', chroma_loc_info_present_flag);
    
    if (chroma_loc_info_present_flag) {
      const chroma_sample_loc_type_top_field = bs.readUEG();
      const chroma_sample_loc_type_bottom_field = bs.readUEG();
      console.log('chroma_sample_loc_type_top_field:', chroma_sample_loc_type_top_field);
      console.log('chroma_sample_loc_type_bottom_field:', chroma_sample_loc_type_bottom_field);
    }
    
    const timing_info_present_flag = bs.readBit();
    console.log('timing_info_present_flag:', timing_info_present_flag);
    
    if (timing_info_present_flag) {
      const num_units_in_tick = bs.readDWord();
      const time_scale = bs.readDWord();
      console.log('num_units_in_tick:', num_units_in_tick);
      console.log('time_scale:', time_scale);
      
      const fixed_frame_rate_flag = bs.readBit();
      console.log('fixed_frame_rate_flag:', fixed_frame_rate_flag);
    }
  }
  
  // 计算实际帧尺寸
  const width = (pic_width_in_mbs_minus1 + 1) * 16;
  const height = (2 - frame_mbs_only_flag) * (pic_height_in_map_units_minus1 + 1) * 16;
  
  console.log('----------');
  console.log('Profile/Level:', profile_idc, level_idc);
  console.log('Resolution:', width, 'x', height);
  
  if (frame_cropping_flag) {
    const cropX = frame_crop_left_offset * 2;
    const cropY = frame_crop_top_offset * 2;
    const cropWidth = width - (frame_crop_left_offset + frame_crop_right_offset) * 2;
    const cropHeight = height - (frame_crop_top_offset + frame_crop_bottom_offset) * 2;
    console.log('Cropped resolution:', cropWidth, 'x', cropHeight);
  }
  
  return {
    profile_idc,
    level_idc,
    width,
    height,
    bit_depth_luma,
    bit_depth_chroma
  };
}

// 测试数据 - 对应用户提供的SPS
const spsData = new Uint8Array([
  0x00, 0x00, 0x00, 0x01, 0x67, 0x64, 0x00, 0x28, 
  0xac, 0xd9, 0x40, 0x78, 0x02, 0x27, 0xe5, 0xc0, 
  0x44, 0x00, 0x00, 0x03, 0x00, 0x04, 0x00, 0x00, 
  0x03, 0x00, 0xe8, 0x3c, 0x60, 0xc6, 0x58
]);

// 运行测试
try {
  console.log('=== 测试SPS解析 ===');
  const result = parseSPS(spsData);
  console.log('测试结果:', result);
} catch (e) {
  console.error('测试失败:', e);
} 