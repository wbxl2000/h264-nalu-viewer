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
        return ((high << skip) | (low >>> (8 - skip))) & 0xff;
    }
    /**
     * 读取16位无符号整数(u(16))
     * @returns 16位无符号整数值
     */
    readHalfWord() {
        const skip = this.bitoffset & 7;
        const byteoffset = this.bitoffset >>> 3;
        this.bitoffset += 16;
        const { view } = this;
        // 如果对齐到字节边界，直接读取
        if (skip === 0) {
            return view.getUint8(byteoffset) * 256 + view.getUint8(byteoffset + 1);
        }
        // 否则需要处理位偏移
        const byte1 = view.getUint8(byteoffset);
        const byte2 = view.getUint8(byteoffset + 1);
        const byte3 = view.getUint8(byteoffset + 2);
        const highBits = (byte1 << skip) | (byte2 >>> (8 - skip));
        const lowBits = (byte2 << skip) | (byte3 >>> (8 - skip));
        return (highBits << 8) | lowBits & 0xff;
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
exports.Bitstream = Bitstream;
