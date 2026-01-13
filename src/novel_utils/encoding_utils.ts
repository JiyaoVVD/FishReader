import * as iconv from 'iconv-lite';
import * as jschardet from 'jschardet';

export async function readFileWithAutoEncoding(fileData: Uint8Array<ArrayBufferLike>): Promise<{
    content: string;
    encoding: string;
    confidence: number;
}> {
    const buffer = Buffer.from(fileData);
    
    // 使用jschardet检测编码
    const detection = jschardet.detect(buffer);
    
    let detectedEncoding = detection.encoding || 'utf8';
    const confidence = detection.confidence || 0;
    
    // 标准化编码名称
    detectedEncoding = normalizeEncodingName(detectedEncoding);
    
    // 解码内容
    let content: string;
    
    if (detectedEncoding.toLowerCase().includes('utf')) {
        // UTF系列编码
        content = buffer.toString(detectedEncoding as BufferEncoding);
    } else {
        // 使用iconv-lite解码非UTF编码
        content = iconv.decode(buffer, detectedEncoding);
    }
    
    // 转换为UTF-8
    const utf8Content = iconv.encode(content, 'utf8').toString('utf8');
    
    return {
        content: utf8Content,
        encoding: detectedEncoding,
        confidence: confidence
    };
}

function normalizeEncodingName(encoding: string): string {
    const encodingMap: { [key: string]: string } = {
        'ascii': 'ascii',
        'utf8': 'utf8',
        'utf-8': 'utf8',
        'utf16le': 'utf16le',
        'utf-16le': 'utf16le',
        'utf16be': 'utf16be',
        'utf-16be': 'utf16be',
        'gb2312': 'gbk',
        'gbk': 'gbk',
        'gb18030': 'gb18030',
        'big5': 'big5',
        'shift_jis': 'shift_jis',
        'euc-jp': 'euc-jp',
        'iso-8859-1': 'iso-8859-1',
        'windows-1252': 'windows-1252'
    };
	return encodingMap[encoding.toLowerCase()] || 'utf8';
}