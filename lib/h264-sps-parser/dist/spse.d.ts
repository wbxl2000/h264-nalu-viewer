export declare type SPSEInfo = {
    nalu_type: 13;
    sps_id: number;
    aux_format_idc: number;
    bit_depth_aux: number;
    alpha_incr_flag: 0 | 1;
    alpha_opaque_value: number;
    alpha_transparent_value: number;
    additional_extension_flag: 0 | 1;
};
export declare function parseSPSE(nalu: Uint8Array): SPSEInfo;
