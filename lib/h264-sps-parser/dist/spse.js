"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bitstream_1 = require("./bitstream");
function parseSPSE(nalu) {
    if ((nalu[0] & 0x1F) !== 13)
        throw new Error("Not an SPSE unit");
    const stream = new bitstream_1.Bitstream(new DataView(nalu.buffer, nalu.byteOffset + 1));
    const spse = {
        nalu_type: 13,
        sps_id: 0,
        aux_format_idc: 0,
        bit_depth_aux: 0,
        alpha_incr_flag: 0,
        alpha_opaque_value: 0,
        alpha_transparent_value: 0,
        additional_extension_flag: 0,
    };
    spse.sps_id = stream.ExpGolomb();
    spse.aux_format_idc = stream.ExpGolomb();
    if (spse.aux_format_idc !== 0) {
        spse.bit_depth_aux = stream.ExpGolomb();
        spse.alpha_incr_flag = stream.readBit();
        spse.alpha_opaque_value = stream.readBit(); // u(v)
        spse.alpha_transparent_value = stream.ExpGolomb(); //u(v)
    }
    spse.additional_extension_flag = stream.readBit();
    return spse;
}
exports.parseSPSE = parseSPSE;
