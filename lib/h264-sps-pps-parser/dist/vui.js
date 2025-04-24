"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVUIParams = void 0;
/**
 * 将二进制数据转换为01字符串，用于调试
 */
function toBinaryString(byte, bits = 8) {
    return byte.toString(2).padStart(bits, '0');
}
/**
 * 调试日志函数，输出参数名称、位置和二进制表示
 */
function debugLog(paramName, value, bitOffset, binaryRep) {
    console.log(`解析VUI参数: ${paramName} = ${value}, 位置: ${Math.floor(bitOffset / 8)}字节 ${bitOffset % 8}位, 二进制: ${binaryRep || toBinaryString(value)}`);
}
/**
 * 读取8位无符号整数（用于u(8)语法元素）
 * 即使不在字节边界上也能正确读取
 */
function readU8(stream) {
    // 读取8个单独的位并组合成一个字节
    const bit7 = stream.readBit();
    const bit6 = stream.readBit();
    const bit5 = stream.readBit();
    const bit4 = stream.readBit();
    const bit3 = stream.readBit();
    const bit2 = stream.readBit();
    const bit1 = stream.readBit();
    const bit0 = stream.readBit();
    return (bit7 << 7) | (bit6 << 6) | (bit5 << 5) | (bit4 << 4) |
        (bit3 << 3) | (bit2 << 2) | (bit1 << 1) | bit0;
}
/**
 * 读取32位无符号整数（用于u(32)语法元素）
 * 通过读取4个字节并合并
 */
function readU32(stream) {
    const byte3 = readU8(stream);
    const byte2 = readU8(stream);
    const byte1 = readU8(stream);
    const byte0 = readU8(stream);
    // 将4个字节合并为一个32位整数
    return (byte3 << 24) | (byte2 << 16) | (byte1 << 8) | byte0;
}
function hrd_parameters(hrd, stream) {
    const cpb_cnt_minus1 = stream.ExpGolomb();
    debugLog("cpb_cnt_minus1", cpb_cnt_minus1, stream.bitoffset);
    hrd.cpb_cnt = cpb_cnt_minus1 + 1;
    hrd.bit_rate_scale = stream.readNibble();
    debugLog("bit_rate_scale", hrd.bit_rate_scale, stream.bitoffset);
    hrd.cpb_size_scale = stream.readNibble();
    debugLog("cpb_size_scale", hrd.cpb_size_scale, stream.bitoffset);
    for (let i = 0; i <= cpb_cnt_minus1; i++) {
        hrd.bit_rate_value[i] = stream.ExpGolomb() + 1;
        debugLog(`bit_rate_value[${i}]`, hrd.bit_rate_value[i], stream.bitoffset);
        hrd.cpb_size_value[i] = stream.ExpGolomb() + 1;
        debugLog(`cpb_size_value[${i}]`, hrd.cpb_size_value[i], stream.bitoffset);
        hrd.cbr_flag[i] = stream.readBit();
        debugLog(`cbr_flag[${i}]`, hrd.cbr_flag[i], stream.bitoffset);
    }
    hrd.initial_cpb_removal_delay_length = stream.read5() + 1;
    debugLog("initial_cpb_removal_delay_length", hrd.initial_cpb_removal_delay_length, stream.bitoffset);
    hrd.cpb_removal_delay_length = stream.read5() + 1;
    debugLog("cpb_removal_delay_length", hrd.cpb_removal_delay_length, stream.bitoffset);
    hrd.dpb_output_delay_length = stream.read5() + 1;
    debugLog("dpb_output_delay_length", hrd.dpb_output_delay_length, stream.bitoffset);
    hrd.time_offset_length = stream.read5();
    debugLog("time_offset_length", hrd.time_offset_length, stream.bitoffset);
}
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
        timing_info_present_flag: 0,
        num_units_in_tick: 0,
        time_scale: 0,
        fixed_frame_rate_flag: 0,
        nal_hrd_parameters_present_flag: 0,
        vcl_hrd_parameters_present_flag: 0,
        hrd_params: {
            cpb_cnt: 0,
            bit_rate_scale: 0,
            cpb_size_scale: 0,
            bit_rate_value: [],
            cpb_size_value: [],
            cbr_flag: [],
            initial_cpb_removal_delay_length: 0,
            cpb_removal_delay_length: 0,
            dpb_output_delay_length: 0,
            time_offset_length: 0,
        },
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
    if (!flag)
        return vp;
    vp.aspect_ratio_info_present_flag = stream.readBit();
    debugLog("aspect_ratio_info_present_flag", vp.aspect_ratio_info_present_flag, stream.bitoffset);
    if (vp.aspect_ratio_info_present_flag) {
        // 根据H.264标准，aspect_ratio_idc是u(8)，需要逐位读取确保不会跨字节
        vp.aspect_ratio_idc = readU8(stream);
        debugLog("aspect_ratio_idc", vp.aspect_ratio_idc, stream.bitoffset);
        if (vp.aspect_ratio_idc === 255) { // Extended_SAR
            vp.sar_width = readU8(stream);
            debugLog("sar_width", vp.sar_width, stream.bitoffset);
            vp.sar_height = readU8(stream);
            debugLog("sar_height", vp.sar_height, stream.bitoffset);
        }
    }
    vp.overscan_info_present_flag = stream.readBit();
    debugLog("overscan_info_present_flag", vp.overscan_info_present_flag, stream.bitoffset);
    if (vp.overscan_info_present_flag) {
        vp.overscan_appropriate_flag = stream.readBit();
        debugLog("overscan_appropriate_flag", vp.overscan_appropriate_flag, stream.bitoffset);
    }
    vp.video_signal_type_present_flag = stream.readBit();
    debugLog("video_signal_type_present_flag", vp.video_signal_type_present_flag, stream.bitoffset);
    if (vp.video_signal_type_present_flag) {
        vp.video_format = (stream.readBit() << 2) |
            (stream.readBit() << 1) |
            stream.readBit();
        debugLog("video_format", vp.video_format, stream.bitoffset);
        vp.video_full_range_flag = stream.readBit();
        debugLog("video_full_range_flag", vp.video_full_range_flag, stream.bitoffset);
        vp.colour_description_present_flag = stream.readBit();
        debugLog("colour_description_present_flag", vp.colour_description_present_flag, stream.bitoffset);
        if (vp.colour_description_present_flag) {
            vp.colour_primaries = readU8(stream);
            debugLog("colour_primaries", vp.colour_primaries, stream.bitoffset);
            vp.transfer_characteristics = readU8(stream);
            debugLog("transfer_characteristics", vp.transfer_characteristics, stream.bitoffset);
            vp.matrix_coefficients = readU8(stream);
            debugLog("matrix_coefficients", vp.matrix_coefficients, stream.bitoffset);
        }
    }
    vp.chroma_loc_info_present_flag = stream.readBit();
    debugLog("chroma_loc_info_present_flag", vp.chroma_loc_info_present_flag, stream.bitoffset);
    if (vp.chroma_loc_info_present_flag) {
        vp.chroma_sample_loc_type_top_field = stream.ExpGolomb();
        debugLog("chroma_sample_loc_type_top_field", vp.chroma_sample_loc_type_top_field, stream.bitoffset);
        vp.chroma_sample_loc_type_bottom_field = stream.ExpGolomb();
        debugLog("chroma_sample_loc_type_bottom_field", vp.chroma_sample_loc_type_bottom_field, stream.bitoffset);
    }
    vp.timing_info_present_flag = stream.readBit();
    debugLog("timing_info_present_flag", vp.timing_info_present_flag, stream.bitoffset);
    if (vp.timing_info_present_flag) {
        // 使用readU32替代stream.readWord()读取32位无符号整数
        vp.num_units_in_tick = readU32(stream);
        debugLog("num_units_in_tick", vp.num_units_in_tick, stream.bitoffset);
        vp.time_scale = readU32(stream);
        debugLog("time_scale", vp.time_scale, stream.bitoffset);
        vp.fixed_frame_rate_flag = stream.readBit();
        debugLog("fixed_frame_rate_flag", vp.fixed_frame_rate_flag, stream.bitoffset);
    }
    vp.nal_hrd_parameters_present_flag = stream.readBit();
    debugLog("nal_hrd_parameters_present_flag", vp.nal_hrd_parameters_present_flag, stream.bitoffset);
    if (vp.nal_hrd_parameters_present_flag) {
        hrd_parameters(vp.hrd_params, stream);
    }
    vp.vcl_hrd_parameters_present_flag = stream.readBit();
    debugLog("vcl_hrd_parameters_present_flag", vp.vcl_hrd_parameters_present_flag, stream.bitoffset);
    if (vp.vcl_hrd_parameters_present_flag) {
        hrd_parameters(vp.hrd_params, stream);
    }
    if (vp.nal_hrd_parameters_present_flag || vp.vcl_hrd_parameters_present_flag) {
        vp.low_delay_hrd_flag = stream.readBit();
        debugLog("low_delay_hrd_flag", vp.low_delay_hrd_flag, stream.bitoffset);
    }
    vp.pic_struct_present_flag = stream.readBit();
    debugLog("pic_struct_present_flag", vp.pic_struct_present_flag, stream.bitoffset);
    vp.bitstream_restriction_flag = stream.readBit();
    debugLog("bitstream_restriction_flag", vp.bitstream_restriction_flag, stream.bitoffset);
    if (vp.bitstream_restriction_flag) {
        vp.motion_vectors_over_pic_boundaries_flag = stream.readBit();
        debugLog("motion_vectors_over_pic_boundaries_flag", vp.motion_vectors_over_pic_boundaries_flag, stream.bitoffset);
        vp.max_bytes_per_pic_denom = stream.ExpGolomb();
        debugLog("max_bytes_per_pic_denom", vp.max_bytes_per_pic_denom, stream.bitoffset);
        vp.max_bits_per_mb_denom = stream.ExpGolomb();
        debugLog("max_bits_per_mb_denom", vp.max_bits_per_mb_denom, stream.bitoffset);
        vp.log2_max_mv_length_horizontal = stream.ExpGolomb();
        debugLog("log2_max_mv_length_horizontal", vp.log2_max_mv_length_horizontal, stream.bitoffset);
        vp.log2_max_mv_length_vertical = stream.ExpGolomb();
        debugLog("log2_max_mv_length_vertical", vp.log2_max_mv_length_vertical, stream.bitoffset);
        vp.num_reorder_frames = stream.ExpGolomb();
        debugLog("num_reorder_frames", vp.num_reorder_frames, stream.bitoffset);
        vp.max_dec_frame_buffering = stream.ExpGolomb();
        debugLog("max_dec_frame_buffering", vp.max_dec_frame_buffering, stream.bitoffset);
    }
    return vp;
}
exports.getVUIParams = getVUIParams;
