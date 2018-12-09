const crypto = require('crypto');
const appConfig = require('./application.json');
const mainService = appConfig.mainService;
const { parseXML, objToWxXML } = require('./xml2js-test');
const Koa = require('koa');
const app = new Koa();

async function wxAuthentication(ctx, next) {
  const { query, method } = ctx.request;
  let { signature, timestamp, nonce, echostr } = query;
  if (!signature || !timestamp || !nonce || !echostr) {
    console.log(`未能成功获取微信参数: ${JSON.stringify(query)}`);
    ctx.body = '不是来自微信，假冒的非法的请求，拒绝';
    return false
  };

  // 将 token timestamp nonce 三个参数进行字典序排序并用sha1加密
  let str = [appConfig.token, timestamp, nonce].sort().join('');
  let strSha1 = crypto.createHash('sha1').update(str).digest('hex');

  console.log(`自己加密后的密文为：${strSha1}`);
  console.log(`微信传入的密文为：${signature}`);
  console.log(`两者比较结果为：${signature === strSha1}`);

  // 返回签名对比结果
  if (signature === strSha1) {
    if (method === 'GET') ctx.body = query.echostr;
    else await next();
  } else ctx.body = '不是来自微信，假冒的非法的请求，拒绝';
}

// 在这里处理来自微信的POST请求
async function messageHandle(ctx, next) {
  let reqData = '';
  let respData = {};
  const { request: req, responese: resp } = ctx;
  req.on('data', chunk => reqData += chunk);
  req.on('end', async () => {
    reqData = await parseXML(reqData);
    reqData = reqData.xml;
    // 响应消息
    if (reqData.MsgType === 'text') {
      respData.to = reqData.FromUserName;
      respData.from = reqData.ToUserName;
      respData.type = reqData.MsgType;
      respData.content = '很高兴收到你的消息！';
    }
    const respXML = await objToWxXML(respData);
    console.log(`响应微信内容：/r/n ${respXML}`);
    ctx.body = respXML;
  });
}

app.use(async (ctx, next) => {
  await next();
  ctx.set('Content-Type', 'text/plain;charset=utf-8');
});

app.use(wxAuthentication);
app.use(messageHandle);

app.listen(mainService.port, () => console.log(`启动wx-node服务:${mainService.port}`));
app.on('error', err => console.log(`server error: ${JSON.stringify(err)}`));
