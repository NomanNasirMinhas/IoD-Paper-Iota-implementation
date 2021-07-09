<script>
  export let name;
  import { v4 as uuidv4 } from "uuid";
  import {} from "node:process";
  let crypto = require("crypto");
  let curves = crypto.getCurves();
  console.log("Curves ", curves);
  let ciphers_list = crypto.getCiphers();
  console.log("Ciphers ", ciphers_list);

  const mongodb = require("mongodb").MongoClient;
  const uri =
    "mongodb://localhost:27017/?readPreference=primary&appname=MongoDB%20Compass&ssl=false";

  const Iota = require("@iota/core");
  const Converter = require("@iota/converter");
  const node = "https://nodes.devnet.iota.org:443";
  //   const node = getNode();
  const iota = Iota.composeAPI({
    provider: node,
  });
  const seed =
    "PUEOTSEITFEVEWCWBTSIZM9NKRGJEIMXTULBACGFRQK9IMGICLBKW9TTEVSDQMGWKBXPVCBMMCXWMNPDX";
  const address =
    "HEQLOWORLDHELLOWORLDHELLOWORLDHELLOWORLDHELLOWORLDHELLOWORLDHELLOWORLDHELLOWOR99D";
  //for Registration Authority
  let RA_id = get_keys();
  let incoming_CR_request = false;
  let CR_requests = [];

  //for Control Room
  let CR_id = false;
  let GSS_requests = [];
  let incoming_GSS_request = false;
  let DR_requests = [];
  let incoming_DR_request = false;

  //for GSS
  let GSS_id = false;
  let DR_Conn_Reqs = [];

  //for Drones
  let DR_id = false;

  //General
  let connected = null;
  let session_key = false;

  //DR-GSS Communication
  let request_id = 0;
  let dr_response = false;
  let dec_res = false;
  let dec_req = false;
  let gss_request = false;
  let iota_hash = false;
  //For Intercept
  let intercepted = [];

  //Functions for Control Room Registration
  function send_cr_to_ra() {
    let req = {
      reqID: `Control Room ${CR_requests.length + 1}`,
      token: null,
    };
    CR_requests = [...CR_requests, req];
    incoming_CR_request = true;
    console.log(CR_requests);
  }

  function cr_to_ra_accept(index) {
    CR_id = get_keys();
    CR_requests[index].token = CR_id;
    incoming_CR_request = false;
  }

  function cr_to_ra_reject(index) {
    CR_requests[index].token = false;
    incoming_CR_request = false;
  }

  //Functions for Registration of Ground Station
  function send_gss_to_cr() {
    let req = {
      reqID: `Ground Station ${GSS_requests.length + 1}`,
      token: null,
    };
    GSS_requests = [...GSS_requests, req];
    incoming_GSS_request = true;
    console.log(GSS_requests);
  }

  function gss_to_cr_accept(index) {
    GSS_id = get_keys();
    GSS_requests[index].token = GSS_id;
    incoming_GSS_request = false;
  }

  function gss_to_cr_reject(index) {
    GSS_requests[index].token = false;
    incoming_GSS_request = false;
  }

  //Functions for Registration of Drones
  function send_dr_to_cr() {
    let req = {
      reqID: `Drone ${DR_requests.length + 1}`,
      token: null,
    };
    DR_requests = [...DR_requests, req];
    incoming_DR_request = true;
    console.log(DR_requests);
  }

  function dr_to_cr_accept(index) {
    DR_id = get_keys();
    DR_requests[index].token = DR_id;
    incoming_DR_request = false;
  }

  function dr_to_cr_reject(index) {
    DR_requests[index].token = false;
    incoming_DR_request = false;
  }

  //Functions for connecting Drone with GSS
  function conn_dr_to_gss(id) {
    let req = {
      reqID: `Drone  Req: ${DR_Conn_Reqs.length + 1}`,
      id: id,
      accepted: null,
    };
    DR_Conn_Reqs = [...DR_Conn_Reqs, req];
    // incoming_DR_request = true;
    console.log(DR_Conn_Reqs);
  }

  function gss_to_dr_accept(index) {
    session_key = get_shared_key(
      GSS_id.pub_key,
      GSS_id.ecdh,
      DR_id.pub_key,
      DR_id.ecdh
    );
    DR_Conn_Reqs[index].accepted = true;
    connected = true;
    alert(`Connection Established with Session Key ${session_key}`);
    // incoming_DR_request = false;
  }

  function gss_to_dr_reject(index) {
    DR_Conn_Reqs[index].accepted = false;
    connected = false;
    // incoming_DR_request = false;
  }

  //Crypto Functions
  function get_keys() {
    let master_key = uuidv4();
    let type = curves[curves.length - 1];
    const ecdh = crypto.createECDH(type);
    const keys = ecdh.generateKeys();
    let pub_key = keys;
    let pri_key = ecdh.getPrivateKey().toString("hex");

    return {
      ecdh,
      master_key,
      pub_key,
      pri_key,
    };
  }

  function get_shared_key(key1, ecdh1, key2, ecdh2) {
    console.log("key1 ", key1);
    console.log("ecdh1 ", ecdh1);
    console.log("key2 ", key2);
    console.log("ecdh2 ", ecdh2);

    const secret1 = ecdh1.computeSecret(key2);
    const secret2 = ecdh2.computeSecret(key1);
    console.log("First Shared Key ", secret1.toString("hex"));
    console.log("Second Shared Key ", secret2.toString("hex"));
    if (secret1.toString("hex") == secret2.toString("hex")) {
      return secret1.toString("hex");
    } else {
      alert("Shared Keys Not Equal");
    }
  }

  function encrypt(data) {
    console.log("Recieved Data ", data);
    console.log("Session Key ", session_key);
    var mykey = crypto.createCipher("aes-128-cbc", session_key);
    var cipher = mykey.update(data, "utf8", "hex");
    cipher += mykey.final("hex");
    console.log("Encrypted Text = ", cipher);
    return cipher;
  }

  function decrypt(data) {
    console.log("Recieved Data ", data);
    console.log("Session Key ", session_key);
    var mykey = crypto.createDecipher("aes-128-cbc", session_key);
    var plain_text = mykey.update(data, "hex", "utf8");
    plain_text += mykey.final("utf8");
    console.log("Decrypted Text ", plain_text);
    return plain_text;
  }

  //Functions for Drone and GSS Communication
  function gss_to_dr_req() {
    dr_response = false;
    dec_res = false;
    dec_req = false;
    iota_hash = false;
    if (Number.parseInt(request_id) < 1) {
      alert("Please Enter a Valid request ID");
    } else {
      console.log("Request ID ", request_id);
      request_id = encrypt(request_id.toString());
      gss_request = true;
    }
  }

  async function dr_to_gss_res() {
    request_id = decrypt(request_id);
    if (Number.parseInt(request_id) >= 1) {
      let res = await fetch(
        `https://jsonplaceholder.typicode.com/todos/${request_id}`
      );
      res = await res.json();
      dr_response = encrypt(JSON.stringify(res));
      var date = new Date();
      add_to_mongo_db({
        type: "drone_response",
        response: JSON.stringify(res),
        timestamp: date,
      });
      console.log("response ", res);
    } else {
      alert("Invalid Request ID");
    }
  }

  function dec_req_id() {
    dec_req = decrypt(request_id);
    var date = new Date();
    add_to_mongo_db({
      type: "request_ID",
      req_ID: dec_req,
      timestamp: date,
    });
  }

  async function dec_response() {
    console.log("In dec_response");
    dec_res = JSON.parse(decrypt(dr_response));
    console.log(dr_response);
    await add_to_iota(JSON.stringify(dec_res));
    request_id = 0;
    gss_request = false;
  }

  //Express Functions
  function add_to_mongo_db(data) {
    mongodb.connect(uri, { useUnifiedTopology: true }, async (err, client) => {
      if (err) return console.error(err);
      else {
        try {
          const dbe = client.db("local");
          let dbobj = dbe.collection("intercepted");
          dbobj.insertOne(data);
        } catch (e) {
          console.log(e);
        }
      }
    });
  }

  function setIotaHash(hash){
    iota_hash = hash;
  }
  async function add_to_iota(data) {
    console.log("In Add to IOTA");
    const depth = 3;
    const minimumWeightMagnitude = 9;
    const messageInTrytes = Converter.asciiToTrytes(data);
    const transfers = [
      {
        value: 0,
        address: address,
        message: messageInTrytes,
      },
    ];

    console.log("Adding DataSet to DLT");
    let t0 = performance.now();
    await iota
      .prepareTransfers(seed, transfers)
      .then((trytes) => {
        return iota.sendTrytes(trytes, depth, minimumWeightMagnitude);
      })
      .then((bundle) => {
        // addTransaction(dbo, address, bundle[0].hash, type);
        setIotaHash(bundle[0].hash);
        // console.log("Added to IOTA with hash ", bundle[0].hash);
      })
      .catch((err) => {
        console.error(err);
      });
    let t1 = performance.now();
    console.log("Added DataSet to DLT");

    console.log(`Time Taken ${t1 - t0}`);
  }
  
</script>

<main>
  <div class="container">
    <h2>
      IOTA-Envisioned Secure Data Delivery and Collection Scheme for <br
      />5G-Based IoT-Enabled Internet of Drones Environment
    </h2>
    <h3>Sayeda Mahnoor Gilani</h3>
    <h3>Noman Nasir Minhas</h3>
  </div>
  <div class="container" style="margin-top: 30px; background-color: #d1f2eb;">
    <h2>Actors</h2>
    {#if connected == true}
      <h3>Session Key: {session_key.substr(0, 30)}...</h3>
    {/if}
    <div style="width: 45%; display: inline-block;">
      <div class="actor-container">
        <h2>Control Room</h2>
        <div>
          {#if CR_id == false}
            <button disabled={CR_id != false} on:click={send_cr_to_ra}
              >Register with RA</button
            >
          {:else}
            <h5>Master Key: {CR_id.master_key}</h5>
            <h5>
              Public Key: {CR_id.pub_key.toString("hex").substr(0, 20)}...
            </h5>
            <h5>Private Key: {CR_id.pri_key.substr(0, 20)}...</h5>
          {/if}
          <!-- Drone Request -->
          <div class="drone-requests">
            {#if DR_requests.length === 0}
              <h3>No Drones Registered</h3>
            {:else}
              <h3>Drones Registered</h3>
              {#each DR_requests as dr_req, index}
                {#if dr_req.token == null}
                  <h4>{dr_req.reqID} --> Pending</h4>
                  {#if dr_req.token == null}
                    <button on:click={() => dr_to_cr_accept(index)}
                      >Accept</button
                    >
                    <button on:click={() => dr_to_cr_reject(index)}
                      >Reject</button
                    >
                  {/if}
                {:else if dr_req.token != null && dr_req.token != false}
                  <h5>
                    {dr_req.reqID} --> {dr_req.token.pub_key
                      .toString("hex")
                      .substr(0, 20)}...
                  </h5>
                {/if}
              {/each}
            {/if}
          </div>

          <div class="gss-requests">
            <!-- Ground Station Requests -->
            {#if GSS_requests.length === 0}
              <h3>No Ground Station Registered</h3>
            {:else}
              <h3>Ground Stations Registered</h3>
              {#each GSS_requests as gss_req, index}
                {#if gss_req.token == null}
                  <h4>{gss_req.reqID} --> Pending</h4>
                  {#if gss_req.token == null}
                    <button on:click={() => gss_to_cr_accept(index)}
                      >Accept</button
                    >
                    <button on:click={() => gss_to_cr_reject(index)}
                      >Reject</button
                    >
                  {/if}
                {:else if gss_req.token != null && gss_req.token != false}
                  <h5>
                    {gss_req.reqID} --> {gss_req.token.pub_key
                      .toString("hex")
                      .substr(0, 20)}...
                  </h5>
                {/if}
              {/each}
            {/if}
          </div>
        </div>
      </div>
      <div class="actor-container">
        <h2>Drone</h2>
        <!-- Registered GSS -->
        {#if DR_id == false}
          <button on:click={send_dr_to_cr}>Register with CR</button>
        {:else}
          <h5>Master Key: {DR_id.master_key}</h5>
          <h5>Public Key: {DR_id.pub_key.toString("hex").substr(0, 20)}...</h5>
          <h5>Private Key: {DR_id.pri_key.substr(0, 20)}...</h5>
        {/if}

        {#if GSS_id == false}
          <h3>No Ground Station Available</h3>
        {:else if connected != true}
          <h4>
            GSS {GSS_id.pub_key.toString("hex").substr(0, 20)}... Available
          </h4>
          <button on:click={() => conn_dr_to_gss(GSS_id)}>Connect</button>
        {/if}
      </div>
    </div>

    <div style="width: 45%; display: inline-block;">
      <div class="actor-container">
        <h2>Registration Authority</h2>
        <h5>Master Key: {RA_id.master_key}</h5>
        <h5>Public Key: {RA_id.pub_key.toString("hex").substr(0, 20)}...</h5>
        <h5>Private Key: {RA_id.pri_key.substr(0, 20)}...</h5>
        <!-- Control Room Requests -->
        {#if CR_requests.length === 0}
          <h3>No Control Room Registered</h3>
        {:else}
          <h3>Control Room Registered</h3>
          {#each CR_requests as cr_req, index}
            {#if cr_req.token == null}
              <h4>{cr_req.reqID} --> Pending</h4>
              {#if cr_req.token == null}
                <button on:click={() => cr_to_ra_accept(index)}>Accept</button>
                <button on:click={() => cr_to_ra_reject(index)}>Reject</button>
              {/if}
            {:else if cr_req.token != null && cr_req.token != false}
              <h5>
                {cr_req.reqID} --> {cr_req.token.pub_key
                  .toString("hex")
                  .substr(0, 20)}...
              </h5>
            {/if}
          {/each}
        {/if}
      </div>
      <div class="actor-container">
        <h2>Ground Station</h2>
        {#if GSS_id == false}
          <button on:click={send_gss_to_cr}>Register with CR</button>
        {:else}
          <h5>Master Key: {GSS_id.master_key}</h5>
          <h5>Public Key: {GSS_id.pub_key.toString("hex").substr(0, 20)}...</h5>
          <h5>Private Key: {GSS_id.pri_key.substr(0, 20)}...</h5>
        {/if}

        <!-- Drone Requests -->
        {#if DR_Conn_Reqs.length === 0}
          <h3>No Control Room Registered</h3>
        {:else}
          <h3>Control Room Registered</h3>
          {#each DR_Conn_Reqs as dr_req, index}
            {#if dr_req.id != false}
              <h4>
                {dr_req.reqID} --> {dr_req.id.pub_key
                  .toString("hex")
                  .substr(0, 20)}...
              </h4>
              {#if dr_req.accepted == null}
                <button on:click={() => gss_to_dr_accept(index)}>Accept</button>
                <button on:click={() => gss_to_dr_reject(index)}>Reject</button>
              {/if}
            {/if}
          {/each}
        {/if}
      </div>
    </div>
  </div>
  {#if connected}
    <div class="container">
      <h2>Ground Station and Drone Communication</h2>
      {#if iota_hash !=false}
            <h5>Added to IOTA with Below Hash</h5>
            <p>{iota_hash}</p>
            {/if}
      <div>
        <div class="actor-container" style="width: 45%; display: inline-block;">
          <h2>Drone</h2>
          {#if gss_request}
            <h5>Encrypted Request ID</h5>
            <p>{request_id}</p>
            <button on:click={dec_req_id}>Decrypt</button>
          {/if}
          {#if dec_req != false}
            <h5>Decrypted Request ID</h5>
            <p>{dec_req}</p>
            <button on:click={async () => await dr_to_gss_res()}
              >Send Response</button
            >
          {/if}
        </div>
        <div class="actor-container" style="width: 45%; display: inline-block;">
          <h2>Ground Station</h2>
          <input
            placeholder="Please Enter A Request ID"
            type="number"
            bind:value={request_id}
          />
          <button on:click={gss_to_dr_req}>Send Request</button>
          {#if dr_response != false}
            <h5>Encrypted Response</h5>
            <p>{dr_response.substr(0, 50)}...</p>
            <button on:click={async () => await dec_response()}>Decrypt</button>
          {/if}
          {#if dec_res != false}
            <h5>Decrypted Response</h5>
            <p>{JSON.stringify(dec_res)}</p>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }

  h2 {
    color: #ff3e00;
    text-transform: uppercase;
  }

  h3 {
    color: #283747;
    font-weight: 400;
  }

  .container {
    border-width: 2cm;
    border-color: black;
    border-radius: 30px;
    border: solid;
  }

  h5 {
    margin: auto;
  }

  .actor-container {
    border-width: 2cm;
    border-color: black;
    border-radius: 30px;
    border: solid;
    margin: 20px;
    /* width: 95%; */
    height: max-content;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }
</style>
