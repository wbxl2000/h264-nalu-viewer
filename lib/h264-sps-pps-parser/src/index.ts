import { Bitstream } from "./bitstream";
import { getVUIParams, VUIParams } from "./vui";

export type FrameCropping = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export { VUIParams, Bitstream };

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
  const scalingList = [];
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
  const right = stream.ExpGolomb();
  const top = stream.ExpGolomb();
  const bottom = stream.ExpGolomb();
  return { left, right, top, bottom };
}

export function parseSPS(nalu: Uint8Array): SPSInfo {
  if ((nalu[0] & 0x1F) !== 7) throw new Error("Not an SPS unit");
 
  const stream = new Bitstream(new DataView(nalu.buffer, nalu.byteOffset + 4));

  const profile_idc = nalu[1];
  const profile_compatibility = nalu[2];
  const level_idc = nalu[3];
  const sps_id = stream.ExpGolomb();

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
    let limit = 8;
    if (chroma_format_idc === 3) {
      limit = 12;
      color_plane_flag = stream.readBit();
    }
    bit_depth_luma = stream.ExpGolomb() + 8;
    bit_depth_chroma = stream.ExpGolomb() + 8;
    qpprime_y_zero_transform_bypass_flag = stream.readBit();
    seq_scaling_matrix_present_flag = stream.readBit();
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
  const pic_order_cnt_type = stream.ExpGolomb();

  let delta_pic_order_always_zero_flag: 0|1 = 0;
  let offset_for_non_ref_pic = 0;
  let offset_for_top_to_bottom_field = 0;

  const offset_for_ref_frame: number[] = [];

  let log2_max_pic_order_cnt_lsb = 0;
  if (pic_order_cnt_type === 0) {
    log2_max_pic_order_cnt_lsb = stream.ExpGolomb() + 4;
  } else if (pic_order_cnt_type === 1) {
    delta_pic_order_always_zero_flag = stream.readBit();
    offset_for_non_ref_pic = stream.SignedExpGolomb();
    offset_for_top_to_bottom_field = stream.SignedExpGolomb();
    const num_ref_frames_in_pic_order_cnt_cycle = stream.ExpGolomb();
    for (let i = 0; i < num_ref_frames_in_pic_order_cnt_cycle; i++) {
      offset_for_ref_frame.push(stream.SignedExpGolomb());
    }
  }

  const max_num_ref_frames = stream.ExpGolomb();
  const gaps_in_frame_num_value_allowed_flag = stream.readBit();
  const pic_width_in_mbs = stream.ExpGolomb() + 1;
  const pic_height_in_map_units = stream.ExpGolomb() + 1;
  const frame_mbs_only_flag = stream.readBit();
  let mb_adaptive_frame_field_flag: 0|1 = 0;
  if (!frame_mbs_only_flag) {
    mb_adaptive_frame_field_flag = stream.readBit();
   }

  const direct_8x8_inference_flag = stream.readBit();
  const frame_cropping_flag = stream.readBit();
  const frame_cropping = getFrameCropping(frame_cropping_flag, stream);

  const vui_parameters_present_flag = stream.readBit();
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
  if ((nalu[0] & 0x1F) !== 8) throw new Error("Not a PPS unit");
 
  const stream = new Bitstream(new DataView(nalu.buffer, nalu.byteOffset + 1));

  const pps_id = stream.ExpGolomb();
  const sps_id = stream.ExpGolomb();
  const entropy_coding_mode_flag: 0|1 = stream.readBit();
  const bottom_field_pic_order_in_frame_present_flag: 0|1 = stream.readBit();
  const num_slice_groups = stream.ExpGolomb() + 1;

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
    switch (slice_group_map_type) {
      case 0: {
        for (let i = 0; i < num_slice_groups; i++) {
          run_length[i] = stream.ExpGolomb() + 1;
        }
        break;
      }
      case 2: {
        for (let i = 0; i < num_slice_groups; i++) {
          top_left[i] = stream.ExpGolomb();
          bottom_right[i] = stream.ExpGolomb();
        }
        break;
      }
      case 3:
      case 4:
      case 5: {
        slice_group_change_direction_flag = stream.readBit();
        slice_group_change_rate = stream.ExpGolomb() + 1;
        break;
      }
      case 6: {
        pic_size_in_map_units = stream.ExpGolomb() + 1;
        for (let i = 0; i < pic_size_in_map_units; i++) {
          slice_group_id[i] = stream.ExpGolomb();
        }
      }
    }
  }

  const num_refs_idx_10_default_active = stream.ExpGolomb();
  const num_refs_idx_11_default_active = stream.ExpGolomb();
  const weighted_pred_flag: 0|1 = stream.readBit();
  const weighted_bipred_idc = (stream.readBit() << 1) | stream.readBit();
  const pic_init_qp = stream.SignedExpGolomb() + 26;
  const pic_init_qs = stream.SignedExpGolomb() + 26;
  const chroma_qp_index_offset = stream.SignedExpGolomb();
  const deblocking_filter_control_present_flag: 0|1 = stream.readBit();
  const constrained_intra_pred_flag: 0|1 = stream.readBit();
  const redundant_pic_cnt_present_flag: 0|1 = stream.readBit();
  
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
    pic_scaling_matrix_present_flag = stream.readBit();
    if (pic_scaling_matrix_present_flag) {
      for (let i = 0; i < 6; i++) {
        const f: 0|1 = stream.readBit();
        pic_scaling_list_present_flag[i] = f;
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