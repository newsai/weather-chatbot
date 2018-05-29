/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const express = require('express'); // app server
const bodyParser = require('body-parser'); // parser for post requests
const watson = require('watson-developer-cloud'); // watson sdk

const app = express();
const weather = require('./weather');

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

// Create the service wrapper

let assistant = new watson.AssistantV1({
  // If unspecified here, the ASSISTANT_USERNAME and ASSISTANT_PASSWORD env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  username: process.env.ASSISTANT_USERNAME || '<username>',
  password: process.env.ASSISTANT_PASSWORD || '<password>',
  version: '2018-02-16'
});

// Endpoint to be call from the client side
app.post('/api/message', function(req, res) {
  let workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if (!workspace || workspace === '<workspace-id>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + 
        '<a href="https://github.com/watson-developer-cloud/assistant-simple">README</a> documentation on how to set this variable. <br>' + 
        'Once a workspace has been defined the intents may be imported from ' + 
        '<a href="https://github.com/watson-developer-cloud/assistant-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    });
  }

  let payload = {
    workspace_id: workspace,
    context: req.body.context || {},
    input: req.body.input || {}
  };

  // Send the input to the assistant service
  assistant.message(payload, function(err, data) {
    if (err) {
      return res.status(err.code || 500).json(err);
    }
    updateMessage(payload, data, res);
  });
});

/**
/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Assistant service
 * @param  {Object} response The response from the Assistant service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response, res) {
  let responseText = null;

  if (!response.output) {
    response.output = {};
    if (response.intents && response.intents[0]) {
      let intent = response.intents[0];
      if (intent.confidence >= 0.75) {
        responseText = 'I understood your intent was ' + intent.intent;
      } else if (intent.confidence >= 0.5) {
        responseText = 'I think your intent was ' + intent.intent;
      } else {
        responseText = 'I did not understand your intent';
      }
    }
    response.output.text = responseText;
  } else {
    let responseOutputText = String(response.output.text);
    let responseContainsRequest = responseOutputText.includes('REQUEST=');
    if (responseContainsRequest) {  // deal with the request
      processWeatherRequest(responseOutputText, response, res);
    } else {
      res.json(response);
    }
  }
  
}

/**
 * process the request in the response message
 * @param {String} responseOutputText the in message
 * @return {String} 
 */
function processWeatherRequest(responseOutputText, response, res) {
  const today = new Date();
  let requestInfo = responseOutputText.split('=')[1].split('|');
  if (requestInfo[1] == '') {
    requestInfo[1] = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
  }
  let forecastingToday = requestInfo[1].split('-')[2] == today.getDate();
  let weatherOutput = weather.getWeather(requestInfo, forecastingToday, response, res);
  console.log(weatherOutput);
  // let locationOutput = weatherOutput[1];
  // weatherOutput = weatherOutput[0];
}

module.exports = app;