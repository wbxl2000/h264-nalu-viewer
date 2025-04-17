import { Bitstream } from "./bitstream";
export declare type HRDParams = {
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
export declare function hrd_parameters(hrd: HRDParams, stream: Bitstream): void;
