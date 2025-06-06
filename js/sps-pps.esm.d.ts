declare class Bitstream {
    view: DataView;
    bitoffset: number;
    constructor(view: DataView);
    /**
     * 调试当前位置的二进制数据
     */
    debugCurrentByte(): string;
    ExpGolomb(): number;
    SignedExpGolomb(): number;
    readBit(): 0 | 1;
    readByte(): number;
    readNibble(): number;
    read5(): number;
    readWord(): number;
    more_rbsp_data(): boolean;
}

type HRDParams = {
    cpb_cnt: number;
    bit_rate_scale: number;
    cpb_size_scale: number;
    bit_rate_value: number[];
    cpb_size_value: number[];
    cbr_flag: (0 | 1)[];
    initial_cpb_removal_delay_length: number;
    cpb_removal_delay_length: number;
    dpb_output_delay_length: number;
    time_offset_length: number;
};
type VUIParams = {
    aspect_ratio_info_present_flag: 0 | 1;
    aspect_ratio_idc: number;
    sar_width: number;
    sar_height: number;
    overscan_info_present_flag: 0 | 1;
    overscan_appropriate_flag: 0 | 1;
    video_signal_type_present_flag: 0 | 1;
    video_format: number;
    video_full_range_flag: 0 | 1;
    colour_description_present_flag: 0 | 1;
    colour_primaries: number;
    transfer_characteristics: number;
    matrix_coefficients: number;
    chroma_loc_info_present_flag: 0 | 1;
    chroma_sample_loc_type_top_field: number;
    chroma_sample_loc_type_bottom_field: number;
    timing_info_present_flag: 0 | 1;
    num_units_in_tick: number;
    time_scale: number;
    fixed_frame_rate_flag: 0 | 1;
    nal_hrd_parameters_present_flag: 0 | 1;
    vcl_hrd_parameters_present_flag: 0 | 1;
    hrd_params: HRDParams;
    low_delay_hrd_flag: 0 | 1;
    pic_struct_present_flag: 0 | 1;
    bitstream_restriction_flag: 0 | 1;
    motion_vectors_over_pic_boundaries_flag: number;
    max_bytes_per_pic_denom: number;
    max_bits_per_mb_denom: number;
    log2_max_mv_length_horizontal: number;
    log2_max_mv_length_vertical: number;
    num_reorder_frames: number;
    max_dec_frame_buffering: number;
};

type FrameCropping = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};

type SPSInfo = {
    sps_id: number;
    profile_idc: number;
    level_idc: number;
    profile_compatibility: number;
    frame_mbs_only_flag: 0 | 1;
    pic_width_in_mbs: number;
    pic_height_in_map_units: number;
    frame_cropping_flag: 0 | 1;
    frame_cropping: FrameCropping;
    chroma_format_idc: number;
    bit_depth_luma: number;
    bit_depth_chroma: number;
    color_plane_flag: 0 | 1;
    qpprime_y_zero_transform_bypass_flag: 0 | 1;
    seq_scaling_matrix_present_flag: 0 | 1;
    seq_scaling_matrix: number[][];
    log2_max_frame_num: number;
    pic_order_cnt_type: number;
    delta_pic_order_always_zero_flag: 0 | 1;
    offset_for_non_ref_pic: number;
    offset_for_top_to_bottom_field: number;
    offset_for_ref_frame: number[];
    log2_max_pic_order_cnt_lsb: number;
    max_num_ref_frames: number;
    gaps_in_frame_num_value_allowed_flag: 0 | 1;
    mb_adaptive_frame_field_flag: 0 | 1;
    direct_8x8_inference_flag: 0 | 1;
    vui_parameters_present_flag: 0 | 1;
    vui_parameters: VUIParams;
};
declare function parseSPS(nalu: Uint8Array): SPSInfo;
type PPSInfo = {
    pps_id: number;
    sps_id: number;
    entropy_coding_mode_flag: 0 | 1;
    bottom_field_pic_order_in_frame_present_flag: 0 | 1;
    num_slice_groups: number;
    slice_group_map_type: number;
    run_length: number[];
    top_left: number[];
    bottom_right: number[];
    slice_group_change_direction_flag: 0 | 1;
    slice_group_change_rate: number;
    pic_size_in_map_units: number;
    slice_group_id: number[];
    num_refs_idx_10_default_active: number;
    num_refs_idx_11_default_active: number;
    weighted_pred_flag: 0 | 1;
    weighted_bipred_idc: number;
    pic_init_qp: number;
    pic_init_qs: number;
    chroma_qp_index_offset: number;
    deblocking_filter_control_present_flag: number;
    constrained_intra_pred_flag: 0 | 1;
    redundant_pic_cnt_present_flag: 0 | 1;
    transform_8x8_mode_flag: 0 | 1;
    pic_scaling_matrix_present_flag: 0 | 1;
    pic_scaling_list_present_flag: (0 | 1)[];
    scaling_list_4x4: number[][];
    scaling_list_8x8: number[][];
    use_default_scaling_matrix_4x4_flag: (0 | 1)[];
    use_default_scaling_matrix_8x8_flag: (0 | 1)[];
    second_chroma_qp_index_offset: number;
};
declare function parsePPS(nalu: Uint8Array, spss: Map<number, SPSInfo>): PPSInfo;

export { Bitstream, parsePPS, parseSPS };
export type { FrameCropping, PPSInfo, SPSInfo, VUIParams };
