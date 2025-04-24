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
	/**
	 * 将二进制数据转换为01字符串，用于调试
	 */
	function toBinaryString(byte, bits = 8) {
	    return byte.toString(2).padStart(bits, '0');
	}
	class Bitstream {
	    view;
	    bitoffset = 0;
	    constructor(view) {
	        this.view = view;
	    }
	    /**
	     * 调试当前位置的二进制数据
	     */
	    debugCurrentByte() {
	        const byteOffset = this.bitoffset >> 3;
	        if (byteOffset >= this.view.byteLength)
	            return "EOF";
	        const byte = this.view.getUint8(byteOffset);
	        return `位置: ${byteOffset}字节 ${this.bitoffset & 7}位, 值: 0x${byte.toString(16).padStart(2, '0')}, 二进制: ${toBinaryString(byte)}`;
	    }
	    ExpGolomb() {
	        console.log(`ExpGolomb解码开始，${this.debugCurrentByte()}`);
	        const { view } = this;
	        let { zeros, skip, byt, byteoffset, } = ExpGolomInit(view, this.bitoffset);
	        console.log(`ExpGolomb找到前缀0的个数: ${zeros}`);
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
	        const result = code - 1;
	        console.log(`ExpGolomb解码结果: ${result}, 新位置: ${byteoffset}字节 ${skip}位`);
	        return result;
	    }
	    SignedExpGolomb() {
	        console.log(`SignedExpGolomb解码开始，${this.debugCurrentByte()}`);
	        const code = this.ExpGolomb();
	        const result = code & 1 ? (code + 1) >>> 1 : -(code >>> 1);
	        console.log(`SignedExpGolomb解码结果: ${result}`);
	        return result;
	    }
	    readBit() {
	        const skip = this.bitoffset & 7;
	        const byteoffset = this.bitoffset >> 3;
	        const byte = this.view.getUint8(byteoffset);
	        const bit = ((byte >>> (7 - skip)) & 1);
	        this.bitoffset++;
	        console.log(`读取1位: ${bit}, 从字节: 0x${byte.toString(16).padStart(2, '0')} (${toBinaryString(byte)}), 位置: ${byteoffset}字节 ${skip}位`);
	        return bit;
	    }
	    readByte() {
	        console.log(`readByte开始，${this.debugCurrentByte()}`);
	        const skip = this.bitoffset & 7;
	        const byteoffset = this.bitoffset >>> 3;
	        this.bitoffset += 8;
	        const high = this.view.getUint8(byteoffset);
	        if (skip === 0) {
	            console.log(`readByte结果: ${high}, 0x${high.toString(16).padStart(2, '0')} (${toBinaryString(high)})`);
	            return high;
	        }
	        const low = this.view.getUint8(byteoffset + 1);
	        const result = (high << skip) | (low >>> (8 - skip));
	        console.log(`readByte结果(跨字节): ${result}, 0x${result.toString(16).padStart(2, '0')} (${toBinaryString(result)})`);
	        return result;
	    }
	    readNibble() {
	        console.log(`readNibble开始，${this.debugCurrentByte()}`);
	        const skip = this.bitoffset & 7;
	        const byteoffset = this.bitoffset >> 3;
	        this.bitoffset += 4;
	        const high = this.view.getUint8(byteoffset);
	        let result;
	        if (skip === 0) {
	            result = high >>> 4;
	        }
	        else if (skip <= 4) {
	            result = (high >>> (4 - skip)) & 0xf;
	        }
	        else {
	            const low = this.view.getUint8(byteoffset + 1);
	            result = ((high << (skip - 4)) | (low >>> (12 - skip))) & 0xf;
	        }
	        console.log(`readNibble结果: ${result}, 0x${result.toString(16)} (${toBinaryString(result, 4)})`);
	        return result;
	    }
	    read5() {
	        console.log(`read5开始，${this.debugCurrentByte()}`);
	        const skip = this.bitoffset & 7;
	        const byteoffset = this.bitoffset >> 3;
	        this.bitoffset += 5;
	        const high = this.view.getUint8(byteoffset);
	        let result;
	        if (skip === 0) {
	            result = high >>> 3;
	        }
	        else if (skip <= 3) {
	            result = (high >>> (3 - skip)) & 0x1f;
	        }
	        else {
	            const low = this.view.getUint8(byteoffset + 1);
	            result = ((high << (skip - 3)) | (low >>> (11 - skip))) & 0x1f;
	        }
	        console.log(`read5结果: ${result}, 0x${result.toString(16)} (${toBinaryString(result, 5)})`);
	        return result;
	    }
	    readWord() {
	        console.log(`readWord开始，${this.debugCurrentByte()}`);
	        const skip = this.bitoffset & 7;
	        const byteoffset = this.bitoffset >>> 3;
	        this.bitoffset += 32;
	        const { view } = this;
	        const tmp = (view.getUint16(byteoffset) * shift16) +
	            view.getUint16(byteoffset + 2);
	        let result;
	        if (skip === 0) {
	            result = tmp;
	        }
	        else {
	            result = (tmp * (2 ** skip)) + (view.getUint8(byteoffset + 4) >>> (8 - skip));
	        }
	        console.log(`readWord结果: ${result}, 0x${result.toString(16).padStart(8, '0')}`);
	        return result;
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
	        const result = false;
	        console.log(`more_rbsp_data结果: ${result}`);
	        return result;
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
	    console.log(`解析VUI参数: ${paramName} = ${value}, 位置: ${Math.floor(bitOffset / 8)}字节 ${bitOffset % 8}位, 二进制: ${toBinaryString(value)}`);
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
		/**
		 * 将Uint8Array转换为十六进制字符串
		 */
		function toHexString(bytes) {
		    return Array.from(bytes)
		        .map(byte => byte.toString(16).padStart(2, '0'))
		        .join(' ');
		}
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
		    console.log(`解析参数: ${paramName} = ${value}, 位置: ${Math.floor(bitOffset / 8)}字节 ${bitOffset % 8}位, 二进制: ${binaryRep || toBinaryString(value)}`);
		}
		/**
		 * 去除H264/AVC NALU中的防竞争字节 (起始码防止字节 0x03)
		 * 当编码后的比特流中出现连续的两个0x00后跟一个0x03时，0x03需要被去除
		 */
		function removeEmulationPreventionBytes(nalu) {
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
		    debugLog("frame_crop_left_offset", left, stream.bitoffset);
		    const right = stream.ExpGolomb();
		    debugLog("frame_crop_right_offset", right, stream.bitoffset);
		    const top = stream.ExpGolomb();
		    debugLog("frame_crop_top_offset", top, stream.bitoffset);
		    const bottom = stream.ExpGolomb();
		    debugLog("frame_crop_bottom_offset", bottom, stream.bitoffset);
		    return { left, right, top, bottom };
		}
		function parseSPS(nalu) {
		    // 输出原始nalu的十六进制数据
		    console.log('SPS NALU hex data (原始):', toHexString(nalu));
		    if ((nalu[0] & 0x1F) !== 7)
		        throw new Error("Not an SPS unit");
		    // 去除防竞争字节
		    const cleanNalu = removeEmulationPreventionBytes(nalu);
		    console.log('SPS NALU hex data (去除防竞争字节后):', toHexString(cleanNalu));
		    const stream = new bitstream_1.Bitstream(new DataView(cleanNalu.buffer, cleanNalu.byteOffset + 4));
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
		    debugLog("log2_max_frame_num_minus4", log2_max_frame_num - 4, stream.bitoffset);
		    const pic_order_cnt_type = stream.ExpGolomb();
		    debugLog("pic_order_cnt_type", pic_order_cnt_type, stream.bitoffset);
		    let delta_pic_order_always_zero_flag = 0;
		    let offset_for_non_ref_pic = 0;
		    let offset_for_top_to_bottom_field = 0;
		    const offset_for_ref_frame = [];
		    let log2_max_pic_order_cnt_lsb = 0;
		    if (pic_order_cnt_type === 0) {
		        log2_max_pic_order_cnt_lsb = stream.ExpGolomb() + 4;
		        debugLog("log2_max_pic_order_cnt_lsb_minus4", log2_max_pic_order_cnt_lsb - 4, stream.bitoffset);
		    }
		    else if (pic_order_cnt_type === 1) {
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
		    let mb_adaptive_frame_field_flag = 0;
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
		    // 输出原始nalu的十六进制数据
		    console.log('PPS NALU hex data (原始):', toHexString(nalu));
		    if ((nalu[0] & 0x1F) !== 8)
		        throw new Error("Not a PPS unit");
		    // 去除防竞争字节
		    const cleanNalu = removeEmulationPreventionBytes(nalu);
		    console.log('PPS NALU hex data (去除防竞争字节后):', toHexString(cleanNalu));
		    const stream = new bitstream_1.Bitstream(new DataView(cleanNalu.buffer, cleanNalu.byteOffset + 1));
		    const pps_id = stream.ExpGolomb();
		    debugLog("pps_id", pps_id, stream.bitoffset);
		    const sps_id = stream.ExpGolomb();
		    debugLog("sps_id", sps_id, stream.bitoffset);
		    const entropy_coding_mode_flag = stream.readBit();
		    debugLog("entropy_coding_mode_flag", entropy_coding_mode_flag, stream.bitoffset);
		    const bottom_field_pic_order_in_frame_present_flag = stream.readBit();
		    debugLog("bottom_field_pic_order_in_frame_present_flag", bottom_field_pic_order_in_frame_present_flag, stream.bitoffset);
		    const num_slice_groups = stream.ExpGolomb() + 1;
		    debugLog("num_slice_groups_minus1", num_slice_groups - 1, stream.bitoffset);
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
		    const weighted_pred_flag = stream.readBit();
		    debugLog("weighted_pred_flag", weighted_pred_flag, stream.bitoffset);
		    const weighted_bipred_idc = (stream.readBit() << 1) | stream.readBit();
		    debugLog("weighted_bipred_idc", weighted_bipred_idc, stream.bitoffset);
		    const pic_init_qp = stream.SignedExpGolomb() + 26;
		    debugLog("pic_init_qp_minus26", pic_init_qp - 26, stream.bitoffset);
		    const pic_init_qs = stream.SignedExpGolomb() + 26;
		    debugLog("pic_init_qs_minus26", pic_init_qs - 26, stream.bitoffset);
		    const chroma_qp_index_offset = stream.SignedExpGolomb();
		    debugLog("chroma_qp_index_offset", chroma_qp_index_offset, stream.bitoffset);
		    const deblocking_filter_control_present_flag = stream.readBit();
		    debugLog("deblocking_filter_control_present_flag", deblocking_filter_control_present_flag, stream.bitoffset);
		    const constrained_intra_pred_flag = stream.readBit();
		    debugLog("constrained_intra_pred_flag", constrained_intra_pred_flag, stream.bitoffset);
		    const redundant_pic_cnt_present_flag = stream.readBit();
		    debugLog("redundant_pic_cnt_present_flag", redundant_pic_cnt_present_flag, stream.bitoffset);
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
		        debugLog("transform_8x8_mode_flag", transform_8x8_mode_flag, stream.bitoffset);
		        pic_scaling_matrix_present_flag = stream.readBit();
		        debugLog("pic_scaling_matrix_present_flag", pic_scaling_matrix_present_flag, stream.bitoffset);
		        if (pic_scaling_matrix_present_flag) {
		            for (let i = 0; i < 6; i++) {
		                const f = stream.readBit();
		                pic_scaling_list_present_flag[i] = f;
		                debugLog(`pic_scaling_list_present_flag[${i}]`, f, stream.bitoffset);
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
		                    debugLog(`pic_scaling_list_present_flag[${i + 6}]`, f, stream.bitoffset);
		                    if (f) {
		                        scaling_list_8x8.push(scaling_list(stream, 64, use_default_scaling_matrix_8x8_flag, i));
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
		exports.parsePPS = parsePPS; 
	} (dist));
	return dist;
}

var distExports = requireDist();
var index = /*@__PURE__*/getDefaultExportFromCjs(distExports);

export { index as default };
