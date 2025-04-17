"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
exports.hrd_parameters = hrd_parameters;
