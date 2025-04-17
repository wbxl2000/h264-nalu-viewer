"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bitstream = void 0;
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
class Bitstream {
    constructor(view) {
        this.view = view;
        this.bitoffset = 0;
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
        return ((this.view.getUint8(byteoffset) >> (7 - skip)) & 1);
    }
    readByte() {
        const skip = this.bitoffset & 7;
        const byteoffset = this.bitoffset >> 3;
        this.bitoffset += 8;
        const high = this.view.getUint8(byteoffset);
        if (skip === 0)
            return high;
        const low = this.view.getUint8(byteoffset + 1);
        return (high << skip) | (low >> (8 - skip));
    }
}
exports.Bitstream = Bitstream;
