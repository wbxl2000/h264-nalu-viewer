import { Bitstream } from "./bitstream";
import { getVUIParams, VUIParams } from "./vui";

export type FrameCropping = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export { VUIParams, Bitstream };

/**
 * 将Uint8Array转换为十六进制字符串
 */
function toHexString(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join(' ');
}

/**
 * 将二进制数据转换为01字符串，用于调试
 */
function toBinaryString(byte: number, bits: number = 8): string {
  return byte.toString(2).padStart(bits, '0');
}

/**
 * 调试日志函数，输出参数名称、位置和二进制表示
 */
function debugLog(paramName: string, value: number, bitOffset: number, binaryRep?: string): void {
  console.log(`解析参数: ${paramName} = ${value}, 位置: ${Math.floor(bitOffset/8)}字节 ${bitOffset%8}位, 二进制: ${binaryRep || toBinaryString(value)}`);
}

/**
 * 去除H264/AVC NALU中的防竞争字节 (起始码防止字节 0x03)
 * 当编码后的比特流中出现连续的两个0x00后跟一个0x03时，0x03需要被去除
 */
function removeEmulationPreventionBytes(nalu: Uint8Array): Uint8Array {
  const length = nalu.length;
  const data = new Uint8Array(length);
  let dataIndex = 0;
  
  for (let i = 0; i < length; i++) {
    // 检查是否是防竞争字节 (0x00 0x00 0x03)
    if (i >= 2 && nalu[i] === 0x03 && nalu[i - 1] === 0x00 && nalu[i - 2] === 0x00) {
      // 跳过0x03
      continue;
    }
    data[dataIndex++] = nalu[i];
  }
  
  // 返回实际长度的数据
  return data.slice(0, dataIndex);
}

export type SPSInfo = {
  sps_id: number;
  profile_idc: number;
  level_idc: number;
  profile_compatibility: number;
  frame_mbs_only_flag: 0|1;
  pic_width_in_mbs: number;
  pic_height_in_map_units: number;
  frame_cropping_flag: 0|1;
  frame_cropping: FrameCropping;

  chroma_format_idc: number;
  bit_depth_luma: number;
  bit_depth_chroma: number;
  color_plane_flag: 0|1;
  qpprime_y_zero_transform_bypass_flag: 0|1;
  seq_scaling_matrix_present_flag: 0|1;
  seq_scaling_matrix: number[][];
  log2_max_frame_num: number;
  pic_order_cnt_type: number;
  delta_pic_order_always_zero_flag: 0|1;
  offset_for_non_ref_pic: number;
  offset_for_top_to_bottom_field: number;
  offset_for_ref_frame: number[];
  log2_max_pic_order_cnt_lsb: number;

  max_num_ref_frames: number;
  gaps_in_frame_num_value_allowed_flag: 0|1;
  mb_adaptive_frame_field_flag: 0|1;
  direct_8x8_inference_flag: 0|1;
  vui_parameters_present_flag: 0|1;
  vui_parameters: VUIParams;
};

function scaling_list(stream: Bitstream, sizeOfScalingList: number, use_default: number[], i: number): number[] {
  let lastScale = 8;
  let nextScale = 8;
  const scalingList: number[] = [];
  for (let j = 0; j < sizeOfScalingList; j++) {
    if (nextScale !== 0) {
      const deltaScale = stream.SignedExpGolomb();
      nextScale = (lastScale + deltaScale + 256) % 256;
      use_default[i] = +(j === 0 && nextScale === 0);
    }
    if (nextScale) { lastScale = nextScale; }
    scalingList[j] = lastScale;
    
  }
  return scalingList;
}

function getFrameCropping(flag: 0|1, stream: Bitstream): FrameCropping {
  if (!flag) return { left: 0, right: 0, top: 0, bottom: 0 };

  const left = stream.ExpGolomb();
  debugLog("frame_crop_left_offset", left, stream.bitoffset);
  
  const right = stream.ExpGolomb();
  debugLog("frame_crop_right_offset", right, stream.bitoffset);
  
  const top = stream.ExpGolomb();
  debugLog("frame_crop_top_offset", top, stream.bitoffset);
  
  const bottom = stream.ExpGolomb();
  debugLog("frame_crop_bottom_offset", bottom, stream.bitoffset);
  
  return { left, right, top, bottom };
}

export function parseSPS(nalu: Uint8Array): SPSInfo {
  // 输出原始nalu的十六进制数据
  console.log('SPS NALU hex data (原始):', toHexString(nalu));
  
  if ((nalu[0] & 0x1F) !== 7) throw new Error("Not an SPS unit");
  
  // 去除防竞争字节
  const cleanNalu = removeEmulationPreventionBytes(nalu);
  console.log('SPS NALU hex data (去除防竞争字节后):', toHexString(cleanNalu));
 
  const stream = new Bitstream(new DataView(cleanNalu.buffer, cleanNalu.byteOffset + 4));

  const profile_idc = cleanNalu[1];
  debugLog("profile_idc", profile_idc, 8, toBinaryString(profile_idc));
  
  const profile_compatibility = cleanNalu[2];
  debugLog("profile_compatibility", profile_compatibility, 16, toBinaryString(profile_compatibility));
  
  const level_idc = cleanNalu[3];
  debugLog("level_idc", level_idc, 24, toBinaryString(level_idc));
  
  const sps_id = stream.ExpGolomb();
  debugLog("sps_id", sps_id, stream.bitoffset);

  let chroma_format_idc = 1;
  let bit_depth_luma = 0;
  let bit_depth_chroma = 0;
  let color_plane_flag: 0|1 = 0;
  let qpprime_y_zero_transform_bypass_flag: 0|1 = 0;
  let seq_scaling_matrix_present_flag: 0|1 = 0;

  const scaling_list_4x4: number[][] = [];
  const scaling_list_8x8: number[][] = [];
  const use_default_scaling_matrix_4x4_flag: number[] = [];
  const use_default_scaling_matrix_8x8_flag: number[] = [];

  if (profile_idc === 100 || profile_idc === 110 ||
      profile_idc === 122 || profile_idc === 244 || profile_idc === 44 ||
      profile_idc === 83  || profile_idc === 86  || profile_idc === 118 ||
      profile_idc === 128 || profile_idc === 138 || profile_idc === 139 ||
      profile_idc === 134 || profile_idc === 135) {
    chroma_format_idc = stream.ExpGolomb();
    debugLog("chroma_format_idc", chroma_format_idc, stream.bitoffset);
    
    let limit = 8;
    if (chroma_format_idc === 3) {
      limit = 12;
      color_plane_flag = stream.readBit();
      debugLog("color_plane_flag", color_plane_flag, stream.bitoffset);
    }
    bit_depth_luma = stream.ExpGolomb() + 8;
    debugLog("bit_depth_luma_minus8", bit_depth_luma - 8, stream.bitoffset);
    
    bit_depth_chroma = stream.ExpGolomb() + 8;
    debugLog("bit_depth_chroma_minus8", bit_depth_chroma - 8, stream.bitoffset);
    
    qpprime_y_zero_transform_bypass_flag = stream.readBit();
    debugLog("qpprime_y_zero_transform_bypass_flag", qpprime_y_zero_transform_bypass_flag, stream.bitoffset);
    
    seq_scaling_matrix_present_flag = stream.readBit();
    debugLog("seq_scaling_matrix_present_flag", seq_scaling_matrix_present_flag, stream.bitoffset);
    
    if (seq_scaling_matrix_present_flag) {
      let i = 0;
      for (; i < 6; i++) {
        if (stream.readBit()) { //seq_scaling_list_present_flag
          scaling_list_4x4.push(
            scaling_list(
              stream, 16,
              use_default_scaling_matrix_4x4_flag, i,
            )
          );
        }
      }
      for (; i < limit; i++) {
        if (stream.readBit()) { //seq_scaling_list_present_flag
          scaling_list_8x8.push(
            scaling_list(
              stream, 64,
              use_default_scaling_matrix_8x8_flag, i - 6,
            )
          );
        }
      }
    }
  }

  const log2_max_frame_num = stream.ExpGolomb() + 4;
  debugLog("log2_max_frame_num_minus4", log2_max_frame_num - 4, stream.bitoffset);
  
  const pic_order_cnt_type = stream.ExpGolomb();
  debugLog("pic_order_cnt_type", pic_order_cnt_type, stream.bitoffset);

  let delta_pic_order_always_zero_flag: 0|1 = 0;
  let offset_for_non_ref_pic = 0;
  let offset_for_top_to_bottom_field = 0;

  const offset_for_ref_frame: number[] = [];

  let log2_max_pic_order_cnt_lsb = 0;
  if (pic_order_cnt_type === 0) {
    log2_max_pic_order_cnt_lsb = stream.ExpGolomb() + 4;
    debugLog("log2_max_pic_order_cnt_lsb_minus4", log2_max_pic_order_cnt_lsb - 4, stream.bitoffset);
  } else if (pic_order_cnt_type === 1) {
    delta_pic_order_always_zero_flag = stream.readBit();
    debugLog("delta_pic_order_always_zero_flag", delta_pic_order_always_zero_flag, stream.bitoffset);
    
    offset_for_non_ref_pic = stream.SignedExpGolomb();
    debugLog("offset_for_non_ref_pic", offset_for_non_ref_pic, stream.bitoffset);
    
    offset_for_top_to_bottom_field = stream.SignedExpGolomb();
    debugLog("offset_for_top_to_bottom_field", offset_for_top_to_bottom_field, stream.bitoffset);
    
    const num_ref_frames_in_pic_order_cnt_cycle = stream.ExpGolomb();
    debugLog("num_ref_frames_in_pic_order_cnt_cycle", num_ref_frames_in_pic_order_cnt_cycle, stream.bitoffset);
    
    for (let i = 0; i < num_ref_frames_in_pic_order_cnt_cycle; i++) {
      offset_for_ref_frame.push(stream.SignedExpGolomb());
      debugLog(`offset_for_ref_frame[${i}]`, offset_for_ref_frame[i], stream.bitoffset);
    }
  }

  const max_num_ref_frames = stream.ExpGolomb();
  debugLog("max_num_ref_frames", max_num_ref_frames, stream.bitoffset);
  
  const gaps_in_frame_num_value_allowed_flag = stream.readBit();
  debugLog("gaps_in_frame_num_value_allowed_flag", gaps_in_frame_num_value_allowed_flag, stream.bitoffset);
  
  const pic_width_in_mbs = stream.ExpGolomb() + 1;
  debugLog("pic_width_in_mbs_minus1", pic_width_in_mbs - 1, stream.bitoffset);
  
  const pic_height_in_map_units = stream.ExpGolomb() + 1;
  debugLog("pic_height_in_map_units_minus1", pic_height_in_map_units - 1, stream.bitoffset);
  
  const frame_mbs_only_flag = stream.readBit();
  debugLog("frame_mbs_only_flag", frame_mbs_only_flag, stream.bitoffset);
  
  let mb_adaptive_frame_field_flag: 0|1 = 0;
  if (!frame_mbs_only_flag) {
    mb_adaptive_frame_field_flag = stream.readBit();
    debugLog("mb_adaptive_frame_field_flag", mb_adaptive_frame_field_flag, stream.bitoffset);
  }

  const direct_8x8_inference_flag = stream.readBit();
  debugLog("direct_8x8_inference_flag", direct_8x8_inference_flag, stream.bitoffset);
  
  const frame_cropping_flag = stream.readBit();
  debugLog("frame_cropping_flag", frame_cropping_flag, stream.bitoffset);
  
  const frame_cropping = getFrameCropping(frame_cropping_flag, stream);

  const vui_parameters_present_flag = stream.readBit();
  debugLog("vui_parameters_present_flag", vui_parameters_present_flag, stream.bitoffset);
  
  const vui_parameters = getVUIParams(vui_parameters_present_flag, stream);

  return {
    sps_id,
    profile_compatibility,
    profile_idc,
    level_idc,
    chroma_format_idc,
    bit_depth_luma,
    bit_depth_chroma,
    color_plane_flag,
    qpprime_y_zero_transform_bypass_flag,
    seq_scaling_matrix_present_flag,
    seq_scaling_matrix: scaling_list_4x4,
    log2_max_frame_num,
    pic_order_cnt_type,
    delta_pic_order_always_zero_flag,
    offset_for_non_ref_pic,
    offset_for_top_to_bottom_field,
    offset_for_ref_frame,
    log2_max_pic_order_cnt_lsb,
    max_num_ref_frames,
    gaps_in_frame_num_value_allowed_flag,
    pic_width_in_mbs,
    pic_height_in_map_units,
    frame_mbs_only_flag,
    mb_adaptive_frame_field_flag,
    direct_8x8_inference_flag,
    frame_cropping_flag,
    frame_cropping,
    vui_parameters_present_flag,
    vui_parameters,
  };
}


export type PPSInfo = {
  pps_id: number;
  sps_id: number;
  entropy_coding_mode_flag: 0|1;
  bottom_field_pic_order_in_frame_present_flag: 0|1;
  num_slice_groups: number;
  slice_group_map_type: number;
  run_length: number[];
  top_left: number[];
  bottom_right: number[];
  slice_group_change_direction_flag: 0|1;
  slice_group_change_rate: number;
  pic_size_in_map_units: number;
  slice_group_id: number[];
  num_refs_idx_10_default_active: number;
  num_refs_idx_11_default_active: number;
  weighted_pred_flag: 0|1;
  weighted_bipred_idc: number;
  pic_init_qp: number;
  pic_init_qs: number;
  chroma_qp_index_offset: number;
  deblocking_filter_control_present_flag: number;
  constrained_intra_pred_flag: 0|1;
  redundant_pic_cnt_present_flag: 0|1;
  transform_8x8_mode_flag: 0|1;
  pic_scaling_matrix_present_flag: 0|1;
  pic_scaling_list_present_flag: (0|1)[];
  scaling_list_4x4: number[][];
  scaling_list_8x8: number[][];
  use_default_scaling_matrix_4x4_flag: (0|1)[];
  use_default_scaling_matrix_8x8_flag: (0|1)[];
  second_chroma_qp_index_offset: number;
};

export function parsePPS(nalu: Uint8Array, spss: Map<number, SPSInfo>): PPSInfo {
  // 输出原始nalu的十六进制数据
  console.log('PPS NALU hex data (原始):', toHexString(nalu));
  
  if ((nalu[0] & 0x1F) !== 8) throw new Error("Not a PPS unit");
  
  // 去除防竞争字节
  const cleanNalu = removeEmulationPreventionBytes(nalu);
  console.log('PPS NALU hex data (去除防竞争字节后):', toHexString(cleanNalu));
 
  const stream = new Bitstream(new DataView(cleanNalu.buffer, cleanNalu.byteOffset + 1));

  const pps_id = stream.ExpGolomb();
  debugLog("pps_id", pps_id, stream.bitoffset);
  
  const sps_id = stream.ExpGolomb();
  debugLog("sps_id", sps_id, stream.bitoffset);
  
  const entropy_coding_mode_flag: 0|1 = stream.readBit();
  debugLog("entropy_coding_mode_flag", entropy_coding_mode_flag, stream.bitoffset);
  
  const bottom_field_pic_order_in_frame_present_flag: 0|1 = stream.readBit();
  debugLog("bottom_field_pic_order_in_frame_present_flag", bottom_field_pic_order_in_frame_present_flag, stream.bitoffset);
  
  const num_slice_groups = stream.ExpGolomb() + 1;
  debugLog("num_slice_groups_minus1", num_slice_groups - 1, stream.bitoffset);

  let slice_group_map_type = 0;
  let slice_group_change_direction_flag: 0|1 = 0;
  let slice_group_change_rate = 0;
  let pic_size_in_map_units = 0;

  const run_length: number[] = [];
  const top_left: number[] = [];
  const bottom_right: number[] = [];
  const slice_group_id: number[] = [];

  if (num_slice_groups > 1) {
    slice_group_map_type = stream.ExpGolomb();
    debugLog("slice_group_map_type", slice_group_map_type, stream.bitoffset);
    
    switch (slice_group_map_type) {
      case 0: {
        for (let i = 0; i < num_slice_groups; i++) {
          run_length[i] = stream.ExpGolomb() + 1;
          debugLog(`run_length_minus1[${i}]`, run_length[i] - 1, stream.bitoffset);
        }
        break;
      }
      case 2: {
        for (let i = 0; i < num_slice_groups; i++) {
          top_left[i] = stream.ExpGolomb();
          debugLog(`top_left[${i}]`, top_left[i], stream.bitoffset);
          
          bottom_right[i] = stream.ExpGolomb();
          debugLog(`bottom_right[${i}]`, bottom_right[i], stream.bitoffset);
        }
        break;
      }
      case 3:
      case 4:
      case 5: {
        slice_group_change_direction_flag = stream.readBit();
        debugLog("slice_group_change_direction_flag", slice_group_change_direction_flag, stream.bitoffset);
        
        slice_group_change_rate = stream.ExpGolomb() + 1;
        debugLog("slice_group_change_rate_minus1", slice_group_change_rate - 1, stream.bitoffset);
        break;
      }
      case 6: {
        pic_size_in_map_units = stream.ExpGolomb() + 1;
        debugLog("pic_size_in_map_units_minus1", pic_size_in_map_units - 1, stream.bitoffset);
        
        for (let i = 0; i < pic_size_in_map_units; i++) {
          slice_group_id[i] = stream.ExpGolomb();
          debugLog(`slice_group_id[${i}]`, slice_group_id[i], stream.bitoffset);
        }
      }
    }
  }

  const num_refs_idx_10_default_active = stream.ExpGolomb();
  debugLog("num_refs_idx_10_default_active", num_refs_idx_10_default_active, stream.bitoffset);
  
  const num_refs_idx_11_default_active = stream.ExpGolomb();
  debugLog("num_refs_idx_11_default_active", num_refs_idx_11_default_active, stream.bitoffset);
  
  const weighted_pred_flag: 0|1 = stream.readBit();
  debugLog("weighted_pred_flag", weighted_pred_flag, stream.bitoffset);
  
  const weighted_bipred_idc = (stream.readBit() << 1) | stream.readBit();
  debugLog("weighted_bipred_idc", weighted_bipred_idc, stream.bitoffset);
  
  const pic_init_qp = stream.SignedExpGolomb() + 26;
  debugLog("pic_init_qp_minus26", pic_init_qp - 26, stream.bitoffset);
  
  const pic_init_qs = stream.SignedExpGolomb() + 26;
  debugLog("pic_init_qs_minus26", pic_init_qs - 26, stream.bitoffset);
  
  const chroma_qp_index_offset = stream.SignedExpGolomb();
  debugLog("chroma_qp_index_offset", chroma_qp_index_offset, stream.bitoffset);
  
  const deblocking_filter_control_present_flag: 0|1 = stream.readBit();
  debugLog("deblocking_filter_control_present_flag", deblocking_filter_control_present_flag, stream.bitoffset);
  
  const constrained_intra_pred_flag: 0|1 = stream.readBit();
  debugLog("constrained_intra_pred_flag", constrained_intra_pred_flag, stream.bitoffset);
  
  const redundant_pic_cnt_present_flag: 0|1 = stream.readBit();
  debugLog("redundant_pic_cnt_present_flag", redundant_pic_cnt_present_flag, stream.bitoffset);
  
  let transform_8x8_mode_flag: 0|1 = 0;
  let pic_scaling_matrix_present_flag: 0|1 = 0;
  let second_chroma_qp_index_offset = 0;

  const pic_scaling_list_present_flag: (0|1)[] = [];
  const scaling_list_4x4: number[][] = [];
  const scaling_list_8x8: number[][] = [];
  const use_default_scaling_matrix_4x4_flag: (0|1)[] = [];
  const use_default_scaling_matrix_8x8_flag: (0|1)[] = [];

  if (stream.more_rbsp_data()) {
    transform_8x8_mode_flag = stream.readBit();
    debugLog("transform_8x8_mode_flag", transform_8x8_mode_flag, stream.bitoffset);
    
    pic_scaling_matrix_present_flag = stream.readBit();
    debugLog("pic_scaling_matrix_present_flag", pic_scaling_matrix_present_flag, stream.bitoffset);
    
    if (pic_scaling_matrix_present_flag) {
      for (let i = 0; i < 6; i++) {
        const f: 0|1 = stream.readBit();
        pic_scaling_list_present_flag[i] = f;
        debugLog(`pic_scaling_list_present_flag[${i}]`, f, stream.bitoffset);
        
        if (f) {
          scaling_list_4x4.push(
            scaling_list(
              stream, 16,
              use_default_scaling_matrix_4x4_flag, i,
            )
          );
        }
      }
      
      if (transform_8x8_mode_flag) {
        const { chroma_format_idc } = spss.get(sps_id) as SPSInfo;
        const limit = chroma_format_idc === 3 ? 6 : 2;
      
        for (let i = 0; i < limit; i++) {
          const f: 0|1 = stream.readBit();
          pic_scaling_list_present_flag[i + 6] = f;
          debugLog(`pic_scaling_list_present_flag[${i+6}]`, f, stream.bitoffset);
          
          if (f) {
            scaling_list_8x8.push(
              scaling_list(
                stream, 64,
                use_default_scaling_matrix_8x8_flag, i,
              )
            );
          }
        }
      }
    }

    second_chroma_qp_index_offset = stream.SignedExpGolomb();
    debugLog("second_chroma_qp_index_offset", second_chroma_qp_index_offset, stream.bitoffset);
  }

  return {
    pps_id, sps_id,
    entropy_coding_mode_flag,
    bottom_field_pic_order_in_frame_present_flag,
    num_slice_groups,
    slice_group_map_type,
    run_length,
    top_left,
    bottom_right,
    slice_group_change_direction_flag,
    slice_group_change_rate,
    pic_size_in_map_units,
    slice_group_id,
    num_refs_idx_10_default_active,
    num_refs_idx_11_default_active,
    weighted_pred_flag,
    weighted_bipred_idc,
    pic_init_qp,
    pic_init_qs,
    chroma_qp_index_offset,
    deblocking_filter_control_present_flag,
    constrained_intra_pred_flag,
    redundant_pic_cnt_present_flag,
    transform_8x8_mode_flag,
    pic_scaling_matrix_present_flag,
    pic_scaling_list_present_flag,
    scaling_list_4x4,
    scaling_list_8x8,
    use_default_scaling_matrix_4x4_flag,
    use_default_scaling_matrix_8x8_flag,
    second_chroma_qp_index_offset,
  };
}