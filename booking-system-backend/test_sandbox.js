const crypto = require('crypto');
const axios = require('axios');

// From StarPay docs Sandbox test dummy
const mchId = "101510000001";
const priKey = "-----BEGIN PRIVATE KEY-----\n" +
    "MIIEugIBADANBgkqhkiG9w0BAQEFAASCBKQwggSgAgEAAoIBAQCcomI4fYcJ8fOW\n" +
    "+KGRTFos85WQcGIP+tRH/WYuaBJs+jWPm2W870WgKwJUk1AUtSlTP6FjRI5XB1y9\n" +
    "jpdE5mupwlF6tvwKsAa8FqBF/mSkDXyttE4HZFau/D+qDKbfUZROZRSoObBF256q\n" +
    "JE/bw/gLcDGe7Vli8rEPnRFtwZuvgx0KQyQ9IW6paR13bSykfLTjTlFezQtoKetO\n" +
    "UEQqPXmz4xaRz0U5oiICPM2D2qT3lALDKEZmbDKaMsNrMdYr37JXE+U+xl6+Mowq\n" +
    "+LnbDMvYcNUaNrUYr2sPZnbdhnn2JON0fqj874QyzV5vKZyD8QpMZLXNFFuVI7b6\n" +
    "ztz3kdcLAgMBAAECggEATYA/Tyo1JeOUnm+ZKdZ4i+NebqBctQFsBc7Iv095Rnir\n" +
    "BcpjFY/iiHSfa4+UQRq+PtWuGfry3vbimVwzVsEYJl/ihvCBVxxvyKL9XISZ8V5H\n" +
    "AX/EV/36sgxXx+EItFieJAf5p58brAUVxaO/68JUOfyiYLuZzc69czdJR2BTkwxq\n" +
    "E5pqFzkxkG++gPXLGye+XTtss2HnA+47RMB/0Q1x6GNZ4FYyU8iPfZlR1QN14YOh\n" +
    "i2BT1TW9kNqZYNrfzcoqJTHhbSif1kYPysOvMLHLlJe3K82Z6EgxhJQq3kBAHiWO\n" +
    "R7Q/w7LLdUa1TkR8ichxfvnuDJrv7oNESelx06ioCQKBgQDjO4V3Q+Uc0cBYduvm\n" +
    "fDTe1WQRaE73BlJEIxKwSvukNdsR9JV6TMKLhdYtnQDTOw5F/cPclG/OsoN+Y+g0\n" +
    "rdYeLVK+s0J1nyidZOTDoasrhqsiFQoazIP0JIxULlTz0lS+RTFaiUXGHoTBQnN5\n" +
    "cfV3fNDSaUFmgme3TfCcQv+Q/wKBgQCwdtBzmyELm0lQ05kLWbfXZ49+UP34S1k7\n" +
    "+7l0wUFiX66l/8o6YddsL2PXoKQxFJNKw6gLk9ewlMQJ5NdbvuZwroLFHeG9F/NA\n" +
    "N2Tj6dfCfAOkg32SlduSerwTtnis9GyNAV3fppZJ8L2XpgnGRjrMsO9nI75E4nT8\n" +
    "5RqaAEDt9QKBgCH6nJKhDHmqw+B2p//nQuCveC9CMcyunU6jEABcthRwGTouIMwQ\n" +
    "/mZutQBNIfp0MkY1FDy/1ZhLCW608dwuwn3wuRbbJ2z/R8uBctPuMPJpSN3n14L6\n" +
    "YiD39iQAaaOsKA/ruN2Y+V4O4jsj/LCEYfhkKbXNF4KErY2zke9L9XtxAoGAWYBp\n" +
    "ybjs0c45KV2pSjB/JinIhfDeX4kYAWxza9x5JUQSeO97ypDFioGeykcYACzHaCxE\n" +
    "l1qtE0rhA4OmF0qD5rMccI3vaNE092UhLtf0LxhnYJGwpyCK9Yh6zCTIoDB4vivr\n" +
    "SPxdTbNk9f2pB3+nYxp60n02jAmv/HTXQTTPueECfzVuICm56p9+N1yyoESg5kPO\n" +
    "RkEliNXy2mGSL7P4iL12zVKWumXH/oHPtRst+1f2NvisXg2Gi5M3y3k8sFrnb21K\n" +
    "Avh2oPZyZ8vBKQl/OmlTIM1cJToIbA0TeT6vulAL4eeMnB4vifm9R/Gv4aaHq5f4\n" +
    "LFXnKaQWR841yjK0LHg=\n" +
    "-----END PRIVATE KEY-----";

async function testSandbox() {
    const reqObj = {
        currency: 'PHP',
        deviceInfo: 'deviceInfo',
        mchId: mchId,
        msgId: Date.now() + '',
        notifyUrl: 'http://localhost:8080/notify',
        service: 'pay.starpay.repayment',
        trxAmount: 5555
    };

    // Sorted stringify
    const sorted = Object.keys(reqObj).sort().reduce((acc, k) => {
        acc[k] = reqObj[k];
        return acc;
    }, {});
    const reqStr = JSON.stringify(sorted);

    const sign = crypto.createSign('SHA256');
    sign.update(reqStr, 'utf8');
    const sig = sign.sign(priKey, 'base64');

    try {
        const r = await axios.post(
            'https://financeapi-uat.wallyt.net/finance-payment-service/v1/repayment',
            { request: reqObj, signature: sig },
            { headers: { 'Content-Type': 'application/json' }, timeout: 20000 }
        );
        console.log(`Sandbox Result:`, JSON.stringify(r.data, null, 2));
    } catch (e) {
        if (e.response) console.log(`Sandbox HTTP ${e.response.status}`, JSON.stringify(e.response.data));
        else console.log(`Sandbox Error`, e.message);
    }
}

testSandbox();
