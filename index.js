'use strict';

const Alexa = require('alexa-sdk');
const http = require('http');
const request = require('request');

exports.handler = (event, context) => {
    const alexa = Alexa.handler(event, context);
    alexa.appId = undefined;
    alexa.registerHandlers(main);
    alexa.execute();
};

const main = {
    'LaunchRequest': function() {
        this.attributes.meetingId = undefined;
        this.response.speak("Welcome to ___. Please set your meeting id");

        // opens mic for user input
        this.handler.response.response.shouldEndSession = false;
        this.emit(':responseReady');
    },
    'SetMeetingIdIntent': function() {
        // check for valid four digit id and that no meeting id has been set
        if (!isNaN(this.event.request.intent.slots.id.value) && this.event.request.intent.slots.id.value.length == 4 && this.attributes.meetingId === undefined) {
            this.attributes.inputHandler_originatingRequestId = this.event.request.requestId;
            this.attributes.button_down = false;
            this.attributes.button_up = false;
            this.attributes.button_down_count = 0;
            this.attributes.button_up_count = 0;
            this.attributes.timed_directive = false;

            this.attributes.meetingId = this.event.request.intent.slots.id.value;
            this.response.speak("meeting id set to " + this.attributes.meetingId);
            delete this.handler.response.response.shouldEndSession;
            console.log('**STARTED INITIAL DIRECTIVE**');
            this.response._addDirective(gameEngineDirective);
            this.emit(':responseReady');

            // check if meeting id has been set
        } else if (this.attributes.meetingId !== undefined) {
            this.response.speak('Use the echo button to save clips from the meeting');
            delete this.handler.response.response.shouldEndSession;
            this.emit(':responseReady');

            // invalid input
        } else {
            this.response.speak('Set your meeting id using the four digit code given to you from the ___ website.');
            this.handler.response.response.shouldEndSession = false;
            this.emit(':responseReady');
        }
    },
    'GameEngine.InputHandlerEvent': function() {
        // stores true events
        // (max size is 1 since button_up and button_down are mutally exclusive)
        let gameEngineEvents = this.event.request.events || [];

        // iterates over true events
        // (again, max size is 1)
        for (let i = 0; i < gameEngineEvents.length; i++) {
            switch (gameEngineEvents[i].name) {
                case 'button_down_event':
                    // check for the first button_down event
                    if (!this.attributes.button_down && !this.attributes.button_up && this.attributes.button_down_count == 0 && this.attributes.button_up_count == 0) {
                        // stop gameEngineDirective
                        buttonStopInputHandlerDirective(this.attributes.inputHandler_originatingRequestId);
                        console.log("**FIRST DOWN RECOGNIZED, STARTING TIMED DIRECTIVE**");

                        this.attributes.timed_directive = true;
                        ++this.attributes.button_down_count;
                        this.attributes.button_down = true;

                        delete this.handler.response.response.shouldEndSession;
                        this.response._addDirective(timedDirective);
                        this.emit(':responseReady');
                    } else {
                        console.log("**BUTTON DOWN**");
                        ++this.attributes.button_down_count;
                        this.attributes.button_down = true;

                        delete this.handler.response.response.shouldEndSession;
                        this.emit(':responseReady');
                    }
                    break;

                case 'button_up_event':
                    // checks if button_up is the first event
                    if (!this.attributes.button_down && !this.attributes.button_up && this.attributes.button_down_count == 0 && this.attributes.button_up_count == 0) {
                        console.log('**HOLD RELEASE**');
                        request.post(
                            'amazonaws.com:8080/request', {
                                json: {
                                    "ID": this.attributes.meetingId,
                                    "state": "HoldUp"
                                }
                            }, (error, response, body) => {
                                console.log('**ENDING TIMED DIRECTIVE**');
                                delete this.handler.response.response.shouldEndSession;
                                this.emit(':responseReady');
                            }
                        );
                    } else {
                        console.log("**BUTTON UP**");
                        delete this.handler.response.response.shouldEndSession;
                        ++this.attributes.button_up_count;
                        this.attributes.button_up = true;
                        this.emit(':responseReady');
                    }
                    break;

                case 'timeout':
                    // timeout for timedDirective
                    if (this.attributes.timed_directive) {
                        if (this.attributes.button_down && this.attributes.button_up && this.attributes.button_down_count == 1 && this.attributes.button_up_count == 1) {
                            console.log("**SINGLE CLICK**");
                            request.post(
                                'amazonaws.com:8080/request', {
                                    json: {
                                        "ID": this.attributes.meetingId,
                                        "state": "Clip30"
                                    }
                                }, (error, response, body) => {
                                    console.log('**ENDING TIMED DIRECTIVE**');
                                    this.attributes.button_down = false;
                                    this.attributes.button_up = false;
                                    this.attributes.button_down_count = 0,
                                        this.attributes.button_up_count = 0;
                                    this.attributes.timed_directive = false;
                                    this.emitWithState("SilentIntent");
                                }
                            );

                        } else if (this.attributes.button_down && this.attributes.button_up && this.attributes.button_down_count > 1 && this.attributes.button_up_count > 1) {
                            console.log("**DOUBLE CLICK**");
                            request.post(
                                'amazonaws.com:8080/request', {
                                    json: {
                                        "ID": this.attributes.meetingId,
                                        "state": "Clip60"
                                    }
                                }, (error, response, body) => {
                                    console.log('**ENDING TIMED DIRECTIVE**');
                                    this.attributes.button_down = false;
                                    this.attributes.button_up = false;
                                    this.attributes.button_down_count = 0,
                                        this.attributes.button_up_count = 0;
                                    this.attributes.timed_directive = false;
                                    this.emitWithState("SilentIntent");
                                }
                            );

                        } else if (this.attributes.button_down && !this.attributes.button_up) {
                            console.log("**HOLD DOWN**");
                            request.post(
                                'amazonaws.com:8080/request', {
                                    json: {
                                        "ID": this.attributes.meetingId,
                                        "state": "HoldDown"
                                    }
                                }, (error, response, body) => {
                                    console.log('**ENDING TIMED DIRECTIVE**');
                                    this.attributes.button_down = false;
                                    this.attributes.button_up = false;
                                    this.attributes.button_down_count = 0,
                                        this.attributes.button_up_count = 0;
                                    this.attributes.timed_directive = false;
                                    this.emitWithState("SilentIntent");
                                }
                            );

                        } else {
                            console.log("**UNKNOWN**");
                            console.log('**ENDING TIMED DIRECTIVE**');
                            this.attributes.button_down = false;
                            this.attributes.button_up = false;
                            this.attributes.button_down_count = 0,
                                this.attributes.button_up_count = 0;
                            this.attributes.timed_directive = false;
                            this.emitWithState("SilentIntent");
                        }
                        // timeout for gameEngineDirective
                    } else {
                        console.log('**ENDING NORMAL DIRECTIVE**');
                        this.emitWithState("SilentIntent");
                    }
                    break;
            }
        }
    },
    'SilentIntent': function() {
        console.log('**STARTING NORMAL DIRECTIVE**');
        this.attributes.inputHandler_originatingRequestId = this.event.request.requestId;
        delete this.handler.response.response.shouldEndSession;
        this.response._addDirective(gameEngineDirective);
        this.emit(':responseReady');
    },
    'AMAZON.HelpIntent': function() {
        if (this.attributes.meetingId === undefined) {
            this.response.speak('Set your meeting id using the four digit code given to you from the ___ website.');
            this.handler.response.response.shouldEndSession = false;
            this.emit(':responseReady');
        } else {
            this.response.speak('Use the echo button to save clips from the meeting');
            delete this.handler.response.response.shouldEndSession;
            this.emit(':responseReady');
        }
    },
    'AMAZON.StopIntent': function() {
        this.response.speak('Thank you for using ___. Goodbye');
        if (this.attributes.inputHandler_originatingRequestId !== undefined) {
            this.response._addDirective(buttonStopInputHandlerDirective(this.attributes.inputHandler_originatingRequestId));
        }
        this.handler.response.response.shouldEndSession = true;
        this.emit(':responseReady');
    },
    'AMAZON.CancelIntent': function() {
        this.response.speak('Thank you for using ___. Goodbye');
        if (this.attributes.inputHandler_originatingRequestId !== undefined) {
            this.response._addDirective(buttonStopInputHandlerDirective(this.attributes.inputHandler_originatingRequestId));
        }
        this.handler.response.response.shouldEndSession = true;
        this.emit(':responseReady');
    },
    'Unhandled': function() {
        if (this.attributes.meetingId === undefined) {
            this.response.speak('Set your meeting id using the four digit code given to you from the ___ website.');
            this.handler.response.response.shouldEndSession = false;
            this.emit(':responseReady');
        } else {
            this.response.speak('Use the echo button to save clips from the meeting');
            delete this.handler.response.response.shouldEndSession;
            this.emit(':responseReady');
        }
    }
};

function requestPost(id, state) {
    request.post(
        'amazonaws.com:8080/request', {
            json: {
                "ID": id,
                "state": state
            }
        }, (error, response, body) => {

        }
    );
}

function sendPost(id, state) {
    let postData = JSON.stringify({
        "ID": id,
        "state": state
    });

    let options = {
        hostname: 'amazonaws.com',
        port: 8080,
        path: '/request',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    let req = http.request(options, (res) => {
        console.log('statusCode:', res.statusCode);
        console.log('headers:', res.headers);

        res.on('data', (d) => {
            process.stdout.write(d);
        });
    });

    req.on('error', (e) => {
        console.error(e);
    });

    req.write(postData);
    req.end();
}

const gameEngineDirective = {
    "type": "GameEngine.StartInputHandler",
    "timeout": 90000,
    "recognizers": {
        "button_down_recognizer": {
            type: "match",
            fuzzy: false,
            anchor: "end",
            "pattern": [{
                "action": "down"
            }]
        },
        "button_up_recognizer": {
            type: "match",
            fuzzy: false,
            anchor: "end",
            "pattern": [{
                "action": "up"
            }]
        }
    },
    "events": {
        "button_down_event": {
            "meets": ["button_down_recognizer"],
            "reports": "matches",
            "shouldEndInputHandler": false
        },
        "button_up_event": {
            "meets": ["button_up_recognizer"],
            "reports": "matches",
            "shouldEndInputHandler": false
        },
        "timeout": {
            "meets": ["timed out"],
            "reports": "history",
            "shouldEndInputHandler": true
        }
    }
};

const timedDirective = {
    "type": "GameEngine.StartInputHandler",
    "timeout": 1500,
    "recognizers": {
        "button_down_recognizer": {
            type: "match",
            fuzzy: false,
            anchor: "end",
            "pattern": [{
                "action": "down"
            }]
        },
        "button_up_recognizer": {
            type: "match",
            fuzzy: false,
            anchor: "end",
            "pattern": [{
                "action": "up"
            }]
        }
    },
    "events": {
        "button_down_event": {
            "meets": ["button_down_recognizer"],
            "reports": "matches",
            "shouldEndInputHandler": false
        },
        "button_up_event": {
            "meets": ["button_up_recognizer"],
            "reports": "matches",
            "shouldEndInputHandler": false
        },
        "timeout": {
            "meets": ["timed out"],
            "reports": "history",
            "shouldEndInputHandler": true
        }
    }
};

const buttonStopInputHandlerDirective = function(inputHandlerOriginatingRequestId) {
    return {
        "type": "GameEngine.StopInputHandler",
        "originatingRequestId": inputHandlerOriginatingRequestId
    }
};