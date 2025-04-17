"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVUIParams = void 0;
function getVUIParams(flag, stream) {
    const vp = {
        aspect_ratio_info_present_flag: 0,
        aspect_ratio_idc: 0,
        sar_width: 0,
        sar_height: 0,
        overscan_info_present_flag: 0,
        overscan_appropriate_flag: 0,
        video_signal_type_present_flag: 0,
        video_format: 0,
        video_full_range_flag: 0,
        colour_description_present_flag: 0,
        colour_primaries: 0,
        transfer_characteristics: 0,
        matrix_coefficients: 0,
        chroma_loc_info_present_flag: 0,
        chroma_sample_loc_type_top_field: 0,
        chroma_sample_loc_type_bottom_field: 0,
        nal_hrd_parameters_present_flag: 0,
        vcl_hrd_parameters_present_flag: 0,
        low_delay_hrd_flag: 0,
        pic_struct_present_flag: 0,
        bitstream_restriction_flag: 0,
        motion_vectors_over_pic_boundaries_flag: 0,
        max_bytes_per_pic_denom: 0,
        max_bits_per_mb_denom: 0,
        log2_max_mv_length_horizontal: 0,
        log2_max_mv_length_vertical: 0,
        num_reorder_frames: 0,
        max_dec_frame_buffering: 0,
    };
    if (flag) {
        vp.aspect_ratio_info_present_flag = stream.readBit();
        if (vp.aspect_ratio_info_present_flag) {
            vp.aspect_ratio_idc = stream.ExpGolomb();
            if (vp.aspect_ratio_idc === 255) { // Extended_SAR
                vp.sar_width = stream.readByte();
                vp.sar_height = stream.readByte();
            }
        }
        vp.overscan_info_present_flag = stream.readBit();
        if (vp.overscan_info_present_flag) {
            vp.overscan_appropriate_flag = stream.readBit();
        }
        vp.video_signal_type_present_flag = stream.readBit();
        if (vp.video_signal_type_present_flag) {
            vp.video_format = (stream.readBit() << 2) |
                (stream.readBit() << 1) |
                stream.readBit();
            vp.video_full_range_flag = stream.readBit();
            vp.colour_description_present_flag = stream.readBit();
            if (vp.colour_description_present_flag) {
                vp.colour_primaries = stream.readByte();
                vp.transfer_characteristics = stream.readByte();
                vp.matrix_coefficients = stream.readByte();
            }
        }
        vp.chroma_loc_info_present_flag = stream.readBit();
        if (vp.chroma_loc_info_present_flag) {
            vp.chroma_sample_loc_type_top_field = stream.ExpGolomb();
            vp.chroma_sample_loc_type_bottom_field = stream.ExpGolomb();
        }
        vp.nal_hrd_parameters_present_flag = stream.readBit();
        vp.vcl_hrd_parameters_present_flag = stream.readBit();
        if (vp.nal_hrd_parameters_present_flag || vp.vcl_hrd_parameters_present_flag) {
            vp.low_delay_hrd_flag = stream.readBit();
        }
        vp.pic_struct_present_flag = stream.readBit();
        vp.bitstream_restriction_flag = stream.readBit();
        if (vp.bitstream_restriction_flag) {
            vp.bitstream_restriction_flag = stream.readBit();
            vp.motion_vectors_over_pic_boundaries_flag = stream.readBit();
            vp.max_bytes_per_pic_denom = stream.ExpGolomb();
            vp.max_bits_per_mb_denom = stream.ExpGolomb();
            vp.log2_max_mv_length_horizontal = stream.ExpGolomb();
            vp.log2_max_mv_length_vertical = stream.ExpGolomb();
            vp.num_reorder_frames = stream.ExpGolomb();
            vp.max_dec_frame_buffering = stream.ExpGolomb();
        }
    }
    return vp;
}
exports.getVUIParams = getVUIParams;
