export declare class Bitstream {
    view: DataView;
    bitoffset: number;
    constructor(view: DataView);
    ExpGolomb(): number;
    SignedExpGolomb(): number;
    readBit(): 0 | 1;
    readByte(): number;
    /**
     * 读取16位无符号整数(u(16))
     * @returns 16位无符号整数值
     */
    readHalfWord(): number;
    readNibble(): number;
    read5(): number;
    readWord(): number;
    more_rbsp_data(): boolean;
}
