export declare class Bitstream {
    view: DataView;
    bitoffset: number;
    constructor(view: DataView);
    ExpGolomb(): number;
    SignedExpGolomb(): number;
    readBit(): 0 | 1;
    readByte(): number;
}
