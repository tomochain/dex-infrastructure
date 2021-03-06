require('dotenv').config()
const _ = require('lodash')
const fs = require('fs')
const utils = require('ethers').utils
const {providers, Contract} = require('ethers')

const {Token, RelayerRegistration} = require('../src/utils/abis')
const {nativeCurrency} = require('../src/config/config')

const coinbaseAddress = process.env.COINBASE_ADDRESS
const relayerRegistrationContractAddress = process.env.RELAYER_REGISTRATION_CONTRACT_ADDRESS
const rpcUrl = process.env.RPC_URL

if (!coinbaseAddress || !relayerRegistrationContractAddress || !rpcUrl) {
  console.log('Please update .env file')
  return
}

let provider = new providers.JsonRpcProvider(process.env.RPC_URL)

const relayerRegistrationContract = new Contract(
  relayerRegistrationContractAddress,
  RelayerRegistration,
  provider,
)

const result = {
  tokens: {},
  pairs: [],
}

const queryRelayerRegistrationContract = async () => {

  const data = await relayerRegistrationContract.getRelayerByCoinbase(coinbaseAddress)

  const makeFee = data[2]
  const takeFee = data[3]
  const fromTokens = data[4]
  const toTokens = data[5]

  const tokens = _.union(fromTokens, toTokens)

  // If there is no token, return immediately
  if (tokens.length === 0) {
    console.log("There is no token")
    return
  }

  if (fromTokens.length !== toTokens.length) {
    console.log("Smart contract returned values are not correct.")
    return
  }

  // Get tokens data
  for (const token of tokens) {
    const tokenContract = new Contract(
      token,
      Token,
      provider,
    )

    const name = await tokenContract.name()
    const symbol = await tokenContract.symbol()
    const decimals = await tokenContract.decimals()

    result.tokens[utils.getAddress(token)] = {
      name: name,
      symbol: symbol,
      decimals: decimals,
      makeFee: makeFee.toString(),
      takeFee: takeFee.toString(),
    }
  }

  // Get pairs data
  for (let i = 0; i < fromTokens.length; i++) {
    const normalizedFromToken = utils.getAddress(fromTokens[i])
    const normalizedToToken = utils.getAddress(toTokens[i])

    // Pair will have the format "ETH/TOMO" for example
    result.pairs.push(`${result.tokens[normalizedFromToken].symbol}/${result.tokens[normalizedToToken].symbol}`)
  }

  for (const address in result.tokens) {
    if (result.tokens[address].symbol === nativeCurrency.symbol) {
      result.tokens[nativeCurrency.address] = result.tokens[address]
      delete result.tokens[address]
      break
    }
  }

  console.log(result)
  fs.writeFileSync(
    'src/config/addresses.json',
    JSON.stringify(result, null, 2),
    'utf8',
  )
}

queryRelayerRegistrationContract()
