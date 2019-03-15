var fetch = require('node-fetch');

var sinceTime = new Date().getTime() - (7 * 24 * 60 * 60 * 1000);
var tasks = 0;
var emails = 0;
var meetings = 0;
var notes = 0;
var deals = 0;
var others = 0;

const HUBSPOT_API_KEY = 'PUT_YOUR_KEY_HERE'
const TRELLO_API_KEY = 'PUT_YOUR_KEY_HERE'
const TRELLO_TOKEN = 'PUT_YOUR_TOKEN_HERE'

var promises = [];
promises.push(fetch(`https://api.hubapi.com/engagements/v1/engagements/paged?hapikey=${HUBSPOT_API_KEY}&limit=250`).then(function (res) {return res.json()}));
promises.push(fetch(`https://api.hubapi.com/deals/v1/deal/recent/modified?hapikey=${HUBSPOT_API_KEY}&since=${sinceTime}`).then(function (res) {return res.json()}));

Promise.all(promises)
    .then(function (jsonResponses) {
        console.log('Number of promises: ' + promises.length);
        
        // console.log(jsonResponses[1]);
        console.log('Number of jsonResponses: ' + jsonResponses.length);

        // for (i = 0; i < jsonResponses.length - 1; i++) {
        //     console.log(i);
            var engJsonResponse = jsonResponses[0];
            var dealJsonResponse = jsonResponses[1];
            //console.log(jsonResponse);
            var engJsonResults = engJsonResponse.results;
            var dealJsonResults = dealJsonResponse.results;
            //console.log(jsonResults);
            //console.log(jsonResults[0]);
            // if ('engagement' in jsonResults[0]) {
                //console.log("there are " + jsonResults.length + " engagements to parse.")
                for (j = 0; j < engJsonResults.length; j++) {
                    var engagement = engJsonResults[j];
                    //console.log(engagement);
                    //console.log(engagement.engagement.lastUpdated, sinceTime);
                    if (engagement.engagement.lastUpdated > sinceTime) {
                        //console.log('This one is new. It is a ' + engagement.engagement.type);
                        switch(engagement.engagement.type) {
                            case "TASK":
                                tasks++;
                                break;
                            case "EMAIL":
                                emails++;
                                break;
                            case "MEETING":
                                meetings++;
                                break;
                            case "NOTE":
                                notes++;
                                break;
                            default:
                                others++;
                        }
                    }
                }
            // } else if ('dealId' in jsonResults[0]) {
                // console.log(jsonResults.length);
                console.log(dealJsonResults);
                for (k = 0; k < dealJsonResults.length - 1; k++) {
                    console.log('k'+k);
                    var deal = dealJsonResults[k];
                    // console.log(deal);
                    var changedProps = deal.properties;
                    if ('dealstage' in changedProps) {
                        console.log('We found one');
                        console.log(changedProps.dealstage);
                        deals++;
                        // var dealstageProp = changedProps.dealstage;
                        // if (dealstageProp.timestamp > dealstageProp.versions.timestamp) {
                        //     deals++;
                        // }
                    }
                }
            }
    //     }
    // }
    )
    .then(function (promise) {
        console.log([tasks, emails, meetings, notes, deals, others]);
        //deals++; //Use this to actually see something come through
        if (tasks + emails + meetings + notes + deals + others > 0) {
            var comment = 'The team updated Hubspot with ';
            var arrActivity = [];
            if (deals > 0) {arrActivity.push(deals + ' deal(s)');}
            if (tasks > 0) {arrActivity.push(tasks + ' task(s)');}
            if (emails > 0) {arrActivity.push(emails + ' email(s)');}
            if (meetings > 0) {arrActivity.push(meetings + ' meeting(s)');}
            if (notes > 0) {arrActivity.push(notes + ' note(s)');}
            if (others > 0) {arrActivity.push(others + ' other(s)');}
            if (arrActivity.length > 1) {
                arrActivity[arrActivity.length -1] = 'and ' + arrActivity[arrActivity.length -1];
            }
            comment += arrActivity.join(', ');
            comment += ' in the last week.';
            //console.log(comment);

            var url = 'PUT_YOUR_TRELLO_URL_HERE'
            var key = TRELLO_API_KEY;
            var token = TRELLO_TOKEN;
            var text = encodeURIComponent(comment);
            //console.log(comment);
            var requestUrl = url + '?key=' + key + '&token=' + token + '&text=' + text;


            fetch(requestUrl, { method: 'POST'})
                .then(function(res) {
                    return res.json();
                }).then(function(json) {
                    console.log(json);
                });
        }
    })
    .catch(function (e) {
        console.log('what went wrong? well...' + e);
    });