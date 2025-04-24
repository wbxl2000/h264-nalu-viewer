export declare class Bitstream {
    view: DataView;
    bitoffset: number;
    constructor(view: DataView);
    /**
     * 调试当前位置的二进制数据
     */
    debugCurrentByte(): string;
    ExpGolomb(): number;
    SignedExpGolomb(): number;
    readBit(): 0 | 1;
    readByte(): number;
    readNibble(): number;
    read5(): number;
    readWord(): number;
    more_rbsp_data(): boolean;
}
