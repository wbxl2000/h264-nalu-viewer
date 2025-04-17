function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var dist = {};

var bitstream = {};

var hasRequiredBitstream;

function requireBitstream () {
	if (hasRequiredBitstream) return bitstream;
	hasRequiredBitstream = 1;
	Object.defineProperty(bitstream, "__esModule", { value: true });
	bitstream.Bitstream = void 0;
	function ExpGolomInit(view, bitoffset) {
	    let bit = 0;
	    let byteoffset = bitoffset >> 3;
	    let skip = bitoffset & 7;
	    let zeros = -1;
	    let byt = view.getUint8(byteoffset) << skip;
	    do {
	        bit = byt & 0x80;
	        byt <<= 1;
	        zeros++;
	        skip++;
	        if (skip === 8) {
	            skip = 0;
	            byteoffset++;
	            byt = view.getUint8(byteoffset);
	        }
	    } while (!bit);
	    return { zeros, skip, byt, byteoffset };
	}
	const shift16 = 2 ** 16;
	class Bitstream {
	    view;
	    bitoffset = 0;
	    constructor(view) {
	        this.view = view;
	    }
	    ExpGolomb() {
	        const { view } = this;
	        let { zeros, skip, byt, byteoffset, } = ExpGolomInit(view, this.bitoffset);
	        let code = 1;
	        while (zeros > 0) {
	            code = (code << 1) | ((byt & 0x80) >>> 7);
	            byt <<= 1;
	            skip++;
	            zeros--;
	            if (skip === 8) {
	                skip = 0;
	                byteoffset++;
	                byt = view.getUint8(byteoffset);
	            }
	        }
	        this.bitoffset = (byteoffset << 3) | skip;
	        return code - 1;
	    }
	    SignedExpGolomb() {
	        const code = this.ExpGolomb();
	        return code & 1 ? (code + 1) >>> 1 : -(code >>> 1);
	    }
	    readBit() {
	        const skip = this.bitoffset & 7;
	        const byteoffset = this.bitoffset >> 3;
	        this.bitoffset++;
	        return ((this.view.getUint8(byteoffset) >>> (7 - skip)) & 1);
	    }
	    readByte() {
	        const skip = this.bitoffset & 7;
	        const byteoffset = this.bitoffset >>> 3;
	        this.bitoffset += 8;
	        const high = this.view.getUint8(byteoffset);
	        if (skip === 0)
	            return high;
	        const low = this.view.getUint8(byteoffset + 1);
	        return (high << skip) | (low >>> (8 - skip));
	    }
	    readNibble() {
	        const skip = this.bitoffset & 7;
	        const byteoffset = this.bitoffset >> 3;
	        this.bitoffset += 4;
	        const high = this.view.getUint8(byteoffset);
	        if (skip === 0)
	            return high >>> 4;
	        if (skip <= 4)
	            return (high >>> (4 - skip)) & 0xf;
	        const low = this.view.getUint8(byteoffset + 1);
	        return ((high << (skip - 4)) | (low >>> (12 - skip))) & 0xf;
	    }
	    read5() {
	        const skip = this.bitoffset & 7;
	        const byteoffset = this.bitoffset >> 3;
	        this.bitoffset += 5;
	        const high = this.view.getUint8(byteoffset);
	        if (skip === 0)
	            return high >>> 3;
	        if (skip <= 3)
	            return (high >>> (3 - skip)) & 0x1f;
	        const low = this.view.getUint8(byteoffset + 1);
	        return ((high << (skip - 3)) | (low >>> (11 - skip))) & 0x1f;
	    }
	    readWord() {
	        const skip = this.bitoffset & 7;
	        const byteoffset = this.bitoffset >>> 3;
	        this.bitoffset += 32;
	        const { view } = this;
	        const tmp = (view.getUint16(byteoffset) * shift16) +
	            view.getUint16(byteoffset + 2);
	        if (skip === 0)
	            return tmp;
	        return (tmp * (2 ** skip)) + (view.getUint8(byteoffset + 4) >>> (8 - skip));
	    }
	    more_rbsp_data() {
	        const skip = this.bitoffset & 7;
	        let byteoffset = this.bitoffset >> 3;
	        const l = this.view.byteLength;
	        if (byteoffset >= l)
	            return false;
	        let byte = (this.view.getUint8(byteoffset) << skip) & 0xff;
	        let found_bit = byte > 0;
	        if (found_bit && !Number.isInteger(Math.log2(byte)))
	            return true;
	        while (++byteoffset < l) {
	            byte = this.view.getUint8(byteoffset);
	            const has_bit = byte > 0;
	            if (found_bit && has_bit)
	                return true;
	            if (has_bit && !Number.isInteger(Math.log2(byte)))
	                return true;
	            found_bit = found_bit || has_bit;
	        }
	        return false;
	    }
	}
	bitstream.Bitstream = Bitstream;
	return bitstream;
}

var vui = {};

var hasRequiredVui;

function requireVui () {
	if (hasRequiredVui) return vui;
	hasRequiredVui = 1;
	Object.defineProperty(vui, "__esModule", { value: true });
	vui.getVUIParams = void 0;
	function hrd_parameters(hrd, stream) {
	    const cpb_cnt_minus1 = stream.ExpGolomb();
	    hrd.cpb_cnt = cpb_cnt_minus1 + 1;
	    hrd.bit_rate_scale = stream.readNibble();
	    hrd.cpb_size_scale = stream.readNibble();
	    for (let i = 0; i <= cpb_cnt_minus1; i++) {
	        hrd.bit_rate_value[i] = stream.ExpGolomb() + 1;
	        hrd.cpb_size_value[i] = stream.ExpGolomb() + 1;
	        hrd.cbr_flag[i] = stream.readBit();
	    }
	    hrd.initial_cpb_removal_delay_length = stream.read5() + 1;
	    hrd.cpb_removal_delay_length = stream.read5() + 1;
	    hrd.dpb_output_delay_length = stream.read5() + 1;
	    hrd.time_offset_length = stream.read5();
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
	    vp.timing_info_present_flag = stream.readBit();
	    if (vp.timing_info_present_flag) {
	        vp.num_units_in_tick = stream.readWord();
	        vp.time_scale = stream.readWord();
	        vp.fixed_frame_rate_flag = stream.readBit();
	    }
	    vp.nal_hrd_parameters_present_flag = stream.readBit();
	    if (vp.nal_hrd_parameters_present_flag) {
	        hrd_parameters(vp.hrd_params, stream);
	    }
	    vp.vcl_hrd_parameters_present_flag = stream.readBit();
	    if (vp.vcl_hrd_parameters_present_flag) {
	        hrd_parameters(vp.hrd_params, stream);
	    }
	    if (vp.nal_hrd_parameters_present_flag || vp.vcl_hrd_parameters_present_flag) {
	        vp.low_delay_hrd_flag = stream.readBit();
	    }
	    vp.pic_struct_present_flag = stream.readBit();
	    vp.bitstream_restriction_flag = stream.readBit();
	    if (vp.bitstream_restriction_flag) {
	        vp.motion_vectors_over_pic_boundaries_flag = stream.readBit();
	        vp.max_bytes_per_pic_denom = stream.ExpGolomb();
	        vp.max_bits_per_mb_denom = stream.ExpGolomb();
	        vp.log2_max_mv_length_horizontal = stream.ExpGolomb();
	        vp.log2_max_mv_length_vertical = stream.ExpGolomb();
	        vp.num_reorder_frames = stream.ExpGolomb();
	        vp.max_dec_frame_buffering = stream.ExpGolomb();
	    }
	    return vp;
	}
	vui.getVUIParams = getVUIParams;
	return vui;
}

var hasRequiredDist;

function requireDist () {
	if (hasRequiredDist) return dist;
	hasRequiredDist = 1;
	(function (exports) {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.parsePPS = exports.parseSPS = exports.Bitstream = void 0;
		const bitstream_1 = requireBitstream();
		Object.defineProperty(exports, "Bitstream", { enumerable: true, get: function () { return bitstream_1.Bitstream; } });
		const vui_1 = requireVui();
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
		function parseSPS(nalu) {
		    if ((nalu[0] & 0x1F) !== 7)
		        throw new Error("Not an SPS unit");
		    const stream = new bitstream_1.Bitstream(new DataView(nalu.buffer, nalu.byteOffset + 4));
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
		    const vui_parameters = (0, vui_1.getVUIParams)(vui_parameters_present_flag, stream);
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
		exports.parseSPS = parseSPS;
		function parsePPS(nalu, spss) {
		    if ((nalu[0] & 0x1F) !== 8)
		        throw new Error("Not a PPS unit");
		    const stream = new bitstream_1.Bitstream(new DataView(nalu.buffer, nalu.byteOffset + 1));
		    const pps_id = stream.ExpGolomb();
		    const sps_id = stream.ExpGolomb();
		    const entropy_coding_mode_flag = stream.readBit();
		    const bottom_field_pic_order_in_frame_present_flag = stream.readBit();
		    const num_slice_groups = stream.ExpGolomb() + 1;
		    let slice_group_map_type = 0;
		    let slice_group_change_direction_flag = 0;
		    let slice_group_change_rate = 0;
		    let pic_size_in_map_units = 0;
		    const run_length = [];
		    const top_left = [];
		    const bottom_right = [];
		    const slice_group_id = [];
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
		    const weighted_pred_flag = stream.readBit();
		    const weighted_bipred_idc = (stream.readBit() << 1) | stream.readBit();
		    const pic_init_qp = stream.SignedExpGolomb() + 26;
		    const pic_init_qs = stream.SignedExpGolomb() + 26;
		    const chroma_qp_index_offset = stream.SignedExpGolomb();
		    const deblocking_filter_control_present_flag = stream.readBit();
		    const constrained_intra_pred_flag = stream.readBit();
		    const redundant_pic_cnt_present_flag = stream.readBit();
		    let transform_8x8_mode_flag = 0;
		    let pic_scaling_matrix_present_flag = 0;
		    let second_chroma_qp_index_offset = 0;
		    const pic_scaling_list_present_flag = [];
		    const scaling_list_4x4 = [];
		    const scaling_list_8x8 = [];
		    const use_default_scaling_matrix_4x4_flag = [];
		    const use_default_scaling_matrix_8x8_flag = [];
		    if (stream.more_rbsp_data()) {
		        transform_8x8_mode_flag = stream.readBit();
		        pic_scaling_matrix_present_flag = stream.readBit();
		        if (pic_scaling_matrix_present_flag) {
		            for (let i = 0; i < 6; i++) {
		                const f = stream.readBit();
		                pic_scaling_list_present_flag[i] = f;
		                if (f) {
		                    scaling_list_4x4.push(scaling_list(stream, 16, use_default_scaling_matrix_4x4_flag, i));
		                }
		            }
		            if (transform_8x8_mode_flag) {
		                const { chroma_format_idc } = spss.get(sps_id);
		                const limit = chroma_format_idc === 3 ? 6 : 2;
		                for (let i = 0; i < limit; i++) {
		                    const f = stream.readBit();
		                    pic_scaling_list_present_flag[i + 6] = f;
		                    if (f) {
		                        scaling_list_8x8.push(scaling_list(stream, 64, use_default_scaling_matrix_8x8_flag, i));
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
		exports.parsePPS = parsePPS; 
	} (dist));
	return dist;
}

var distExports = requireDist();
var index = /*@__PURE__*/getDefaultExportFromCjs(distExports);

export { index as default };
