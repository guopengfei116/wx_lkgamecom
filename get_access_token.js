const axios = require('axios');
const http = require('http');
const appConfig = require('./application.json');
const { getTokenService, wxAPI } = appConfig;

/**
 * 负责请求微信的接口获取token，返回一个Promise对象
*/
function requestAccessToken2() {
  return new Promise((resolve, reject) => {
    // 请求微信接口
    http.request({
      host: wxAPI.domain,
      path: wxAPI.path,
      method: 'GET',
      callback(resp) {
        let result = "";
        resp.on('data', chunk => result += chunk);
        resp.on('end', () => {
          console.log("调用微信access_token接口成功");
          try {
            result = JSON.parse(result);
            console.log("解析access_token成功");
            resolve(result);
          } catch(e) {
            console.log("解析access_token失败");
            reject(e);
          }
        });
      },
    }).on('error', (e) => {
      console.error(`调用微信access_token接口失败: ${e.message}`);
      reject(e);
    });
  });
}

function requestAccessToken() {
  const url = `${wxAPI.domain}${wxAPI.path}${wxAPI.params}`;
  return axios.get(url).then((resp) => {
    return Promise.resolve(resp.data);
  });
}

/**
 * 因为token每天只能获取2000次，而且获取了新的旧的就会失效
 * 所以这个函数对access_token进行了缓存处理
*/
const getAccessToken = (function() {
  const tokenCache = {
    access_token: null,
    update_time: Date.now(),
    expires: 7200
  };
  return async function (req, resp) {
    // 优先使用缓存
    if (tokenCache.access_token && (Date.now() - tokenCache.update_time) / 1000 < tokenCache.expires) {
      return tokenCache.access_token;
    }
    // 无缓存，请求微信API，然后缓存结果
    try {
      let result = await requestAccessToken();
      Object.assign(tokenCache, result, { update_time: Date.now() });
      return tokenCache.access_token;
    } catch(e) {
      return null;
    }
  }
}());

const app = http.createServer(async (req, resp) => {
  resp.setHeader('Content-Type', 'application/json;charset=utf-8');
  const access_token = await getAccessToken();

  if (access_token) {
    resp.write(access_token);
  } else {
    resp.write(JSON.stringify({code: 500, msg: 'access_token获取失败'}));
  }

  resp.end();
})
.listen(getTokenService.port, () => {
  console.log(`启动Node服务，监听端口${getTokenService.port}`);
})
.on('close', () => {
  console.log(`Node服务${getTokenService.port}端口已关闭`);
});
