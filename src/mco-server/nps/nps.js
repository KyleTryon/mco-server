var fs = require('fs')
var crypto = require('crypto')
var NodeRSA = require('node-rsa')
var logger = require('winston')

logger.cli()
// logger.add(logger.transports.File, { filename: 'logs/mco_server.log' })
logger.add(require('winston-daily-rotate-file'), {
  filename: 'logs/mco-server_log.json',
  json: true,
  prepend: true,
  datePattern: 'yyyy-MM-dd_'
})
logger.level = 'debug'

var privateKeyFilename = './data/private_key.pem'
var cryptoLoaded = false
var privateKey
var session_key
// var session_cypher
var session_decypher
var contextId = Buffer.alloc(34)
var customerId = Buffer.alloc(4)
var userId = Buffer.alloc(4)

function initCrypto () {
  if (cryptoLoaded === false) {
    try {
      fs.statSync(privateKeyFilename)
    } catch (e) {
      throw new Error('Error loading private key: ' + e)
    }
    privateKey = new NodeRSA(fs.readFileSync(privateKeyFilename))
    cryptoLoaded = true
  }
}

function npsGetCustomerIdByContextId (contextIdRequest) {
  contextId = contextIdRequest
  switch (contextId.toString()) {
    case 'd316cd2dd6bf870893dfbaaf17f965884e':
      userId = Buffer.from([0x00, 0x00, 0x00, 0x01])
      customerId = Buffer.from([0xAB, 0x01, 0x00, 0x00])
      return {
        'userId': userId,
        'customerId': customerId
      }
    case '5213dee3a6bcdb133373b2d4f3b9962758':
      userId = Buffer.from([0x00, 0x00, 0x00, 0x02])
      customerId = Buffer.from([0xAC, 0x01, 0x00, 0x00])
      return {
        'userId': userId,
        'customerId': customerId
      }
  }
}

function npsGetPersonaMapsByCustomerId () {
  var name = Buffer.alloc(30)
  switch (customerId.readUInt32BE()) {
    case 2868969472:
      Buffer.from('Doc Brown', 'utf8').copy(name)
      return {
        'personacount': Buffer.from([0x00, 0x01]),
        'maxpersonas': Buffer.from([0x00, 0x06]),
        'id': Buffer.from([0x00, 0x00, 0x00, 0x01]),
        'name': name,
        'shardid': Buffer.from([0x00, 0x00, 0x00, 0x2C])
      }
    case 2885746688:
      Buffer.from('Biff', 'utf8').copy(name)
      return {
        'personacount': Buffer.from([0x00, 0x01]),
        'maxpersonas': Buffer.from([0x00, 0x06]),
        'id': Buffer.from([0x00, 0x00, 0x00, 0x02]),
        'name': name,
        'shardid': Buffer.from([0x00, 0x00, 0x00, 0x2C])
      }
  }
}

function getRequestCode (rawBuffer) {
  var requestCode = toHex(rawBuffer[0]) + toHex(rawBuffer[1])
  switch (requestCode) {
    case '0100':
      return '(0x0100)NPS_REQUEST_GAME_CONNECT_SERVER'
    case '0501':
      return '(0x0501)NPS_REQUEST_USER_LOGIN'
    case '0503':
      return '(0x503) NPSSelectGamePersona'
    case '050F':
      return '(0x050F)NPSLogOutGameUser'
    case '0519':
      return '(0x0519)NPS_REQUEST_GET_PERSONA_INFO_BY_NAME'
    case '0532':
      return '(0x0532)NPS_REQUEST_GET_PERSONA_MAPS'
    case '0533': // debug
      return '(0x0533)NPSValidatePersonaName'
    case '0534': // debug
      return '(0x0534)NPSCheckToken'
    case '1101':
      return '(0x1101)NPSSendCommand'
    case '2472':
    case '7B22':
    case '4745':
    case 'FBC0':
      return 'p2pool'
    default:
      return 'Unknown request code: ' + requestCode
  }
}

function setContextIdFromRequest (data) {
  data.copy(contextId, 0, 14, 48)
}

function setCustomerIdFromRequest (data) {
  data.copy(customerId, 0, 12)
}

function dumpRequest (sock, rawBuffer, requestCode) {
  console.log()
  logger.debug('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  logger.debug('Request Code: ' + requestCode)
  logger.debug('-----------------------------------------')
  logger.debug('Request DATA ' + sock.remoteAddress + ':' + sock.localPort + ': ' + rawBuffer.toString('ascii'))
  logger.debug('=========================================')
  logger.debug('Request DATA ' + sock.remoteAddress + ': ' + rawBuffer.toString('hex'))
  logger.debug('-----------------------------------------')
  logger.debug('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-')
  console.log()
}

function dumpResponse (data, count) {
  logger.debug('Response Length: ' + data.length)
  var responseBytes = 'Response Code: ' + toHex(data[0])
  for (var i = 1; (i < count && i < data.length); i++) {
    responseBytes += ' ' + toHex(data[i])
  }
  logger.debug(responseBytes)
}

function toHex (d) {
  return ('0' + (Number(d).toString(16))).slice(-2).toUpperCase()
}

function decryptSessionKey (encryptedKeySet) {
  initCrypto()
  try {
    encryptedKeySet = Buffer.from(encryptedKeySet.toString('utf8'), 'hex')
    var encryptedKeySetB64 = encryptedKeySet.toString('base64')
    var decrypted = privateKey.decrypt(encryptedKeySetB64, 'base64')
    session_key = Buffer.from(Buffer.from(decrypted, 'base64').toString('hex').substring(4, 20), 'hex')
    var desIV = Buffer.alloc(8)
    // session_cypher = crypto.createCipheriv('des-cbc', Buffer.from(session_key, 'hex'), desIV).setAutoPadding(false)
    session_decypher = crypto.createDecipheriv('des-cbc', Buffer.from(session_key, 'hex'), desIV).setAutoPadding(false)
    logger.debug('decrypted: ', session_key)
  } catch (e) {
    logger.error(e)
  }
}

function decryptCmd (cypherCmd) {
  // logger.debug('raw cmd: ' + cypherCmd + cypherCmd.length)
  var plaintext = session_decypher.update(cypherCmd)
  return plaintext
}

module.exports = {
  userId: userId,
  customerId: customerId,
  contextId: contextId,
  setContextIdFromRequest: setContextIdFromRequest,
  setCustomerIdFromRequest: setCustomerIdFromRequest,
  npsGetCustomerIdByContextId: npsGetCustomerIdByContextId,
  npsGetPersonaMapsByCustomerId: npsGetPersonaMapsByCustomerId,
  getRequestCode: getRequestCode,
  dumpRequest: dumpRequest,
  dumpResponse: dumpResponse,
  toHex: toHex,
  decryptSessionKey: decryptSessionKey,
  decryptCmd: decryptCmd,
  initCrypto: initCrypto,
  logger: logger
}