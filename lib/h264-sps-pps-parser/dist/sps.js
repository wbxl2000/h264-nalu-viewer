"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bitstream_1 = require("./bitstream");
exports.Bitstream = bitstream_1.Bitstream;
const vui_1 = require("./vui");
function scaling_list(stream, sizeOfScalingList, use_default, i) {
    let lastScale = 8;
    let nextScale = 8;
    const scalingList = [];
    for (let j = 0; j < sizeOfScalingList; j++) {
        if (nextScale !== 0) {
            const deltaScale = stream.SignedExpGolomb();
            nextScale = (lastScale + deltaScale + 256) % 256;
            use_default[i] = +(j === 0 && nextScale === 0);
        }
        if (nextScale) {
            lastScale = nextScale;
        }
        scalingList[j] = lastScale;
    }
    return scalingList;
}
function getFrameCropping(flag, stream) {
    if (!flag)
        return { left: 0, right: 0, top: 0, bottom: 0 };
    const left = stream.ExpGolomb();
    const right = stream.ExpGolomb();
    const top = stream.ExpGolomb();
    const bottom = stream.ExpGolomb();
    return { left, right, top, bottom };
}
exports.getFrameCropping = getFrameCropping;
function parseSPS(nalu) {
    if ((nalu[0] & 0x1F) !== 7)
        throw new Error("Not an SPS unit");
    const stream = new bitstream_1.Bitstream(new DataView(nalu.buffer, nalu.byteOffset + 4));
    return sps_data(nalu, stream);
}
exports.parseSPS = parseSPS;
function sps_data(nalu, stream) {
    const profile_idc = nalu[1];
    const profile_compatibility = nalu[2];
    const level_idc = nalu[3];
    const sps_id = stream.ExpGolomb();
    let chroma_format_idc = 1;
    let bit_depth_luma = 0;
    let bit_depth_chroma = 0;
    let color_plane_flag = 0;
    let qpprime_y_zero_transform_bypass_flag = 0;
    let seq_scaling_matrix_present_flag = 0;
    const scaling_list_4x4 = [];
    const scaling_list_8x8 = [];
    const use_default_scaling_matrix_4x4_flag = [];
    const use_default_scaling_matrix_8x8_flag = [];
    if (profile_idc === 100 || profile_idc === 110 ||
        profile_idc === 122 || profile_idc === 244 || profile_idc === 44 ||
        profile_idc === 83 || profile_idc === 86 || profile_idc === 118 ||
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
                    scaling_list_4x4.push(scaling_list(stream, 16, use_default_scaling_matrix_4x4_flag, i));
                }
            }
            for (; i < limit; i++) {
                if (stream.readBit()) { //seq_scaling_list_present_flag
                    scaling_list_8x8.push(scaling_list(stream, 64, use_default_scaling_matrix_8x8_flag, i - 6));
                }
            }
        }
    }
    const log2_max_frame_num = stream.ExpGolomb() + 4;
    const pic_order_cnt_type = stream.ExpGolomb();
    let delta_pic_order_always_zero_flag = 0;
    let offset_for_non_ref_pic = 0;
    let offset_for_top_to_bottom_field = 0;
    const offset_for_ref_frame = [];
    let log2_max_pic_order_cnt_lsb = 0;
    if (pic_order_cnt_type === 0) {
        log2_max_pic_order_cnt_lsb = stream.ExpGolomb() + 4;
    }
    else if (pic_order_cnt_type === 1) {
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
    let mb_adaptive_frame_field_flag = 0;
    if (!frame_mbs_only_flag) {
        mb_adaptive_frame_field_flag = stream.readBit();
    }
    const direct_8x8_inference_flag = stream.readBit();
    const frame_cropping_flag = stream.readBit();
    const frame_cropping = getFrameCropping(frame_cropping_flag, stream);
    const vui_parameters_present_flag = stream.readBit();
    const vui_parameters = vui_1.getVUIParams(vui_parameters_present_flag, stream);
    return {
        nalu_type: 7,
        sps_id,
        profile_compatibility,
        profile_idc,
        level_idc,
        chroma_format_idc,
        bit_depth_luma,
        bit_depth_chroma,
        color_plane_flag,
        chroma_array_type: color_plane_flag ? chroma_format_idc : 0,
        qpprime_y_zero_transform_bypass_flag,
        seq_scaling_matrix_present_flag,
        scaling_list_4x4,
        scaling_list_8x8,
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
exports.sps_data = sps_data;
