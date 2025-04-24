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
exports.Bitstream = Bitstream;
