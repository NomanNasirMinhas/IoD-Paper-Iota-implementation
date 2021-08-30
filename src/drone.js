const sha256 = require("js-sha256").sha256;

function getDroneCode(droneID, code){
  let droneCode = code + droneID;
  return sha256(droneCode.toString())
}

module.exports = {getDroneCode}