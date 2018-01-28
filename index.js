/**
 * Queues to an SNS topic geolocation events sent from the Proximity Events iPhone app.
 * Designed to be invoked by the AWS API Gateway as a Lambda Proxy function.
 *
 * @author Tim Malone <tdmalone@gmail.com>
 * @see http://proximityevents.com/faq/index.html
 */

'use strict';

const aws = require( 'aws-sdk' ),
      querystring = require( 'querystring' );

/* eslint-disable no-process-env */
const CI = 'true' === process.env.CI,
      SNS_QUEUE = process.env.SNS_QUEUE;
/* eslint-enable no-process-env */

const FIRST_ITEM = 0,
      HTTP_OK = 200,
      HTTP_SERVER_ERROR = 500,
      TO_MILLISECONDS = 1000;

exports.handler = ( event, context, callback ) => {

  // Prepare the API response.
  const response = {
    isBase64Encoded: false,
    statusCode:      HTTP_OK,
    headers:         {}
  };

  // Put together the event data we want.
  let geoEventData;
  try {
    geoEventData = parseInput( event.body, event.headers['content-type']);
  } catch ( error ) {
    exitWithError( 'Error: Could not parse input. ' + error + '. ' + event.body, callback );
    return;
  }

  geoEventData.person = event.queryStringParameters.person;

  // Normalize the data that Proximity Events sends with its occasional form-data requests.
  // We want to use the same fields that we have available for the usual JSON requests.
  /* eslint-disable camelcase */
  if ( 'application/x-www-form-urlencoded' === event.headers['content-type']) {

    geoEventData.comments = 'Converted from form-data';

    geoEventData.event_latitude = geoEventData.latitude;
    geoEventData.event_longitude = geoEventData.longitude;
    geoEventData.event_accuracy_m = '0.0'; // Unavailable.
    geoEventData.event_address = 'Unknown location'; // Unavailable, although we could look it up.
    geoEventData.trigger_name = geoEventData.id;
    geoEventData.trigger_type = 'Geofence';

    // Generate eg. 'Geofence:Exit' from 'exit'.
    geoEventData.event_type = (
      'Geofence:' + geoEventData.trigger.replace( /^(\w)/, letter => letter.toUpperCase() )
    );

    // Convert eg. '1516705689.304757' to eg. '2018-01-09T21:38:30+11:00'.
    // TODO: Need to add timezone handling to this.
    geoEventData.event_date = new Date( parseInt( geoEventData.timestamp * TO_MILLISECONDS ) );
    geoEventData.event_date = geoEventData.event_date.toISOString();

    delete geoEventData.device;
    delete geoEventData.device_model;
    delete geoEventData.device_type;
    delete geoEventData.latitude;
    delete geoEventData.longitude;
    delete geoEventData.id;
    delete geoEventData.trigger;
    delete geoEventData.timestamp;

  }
  /* eslint-enable camelcase */

  // Drop Visit:Exit events, as they'll often supply an old address way too late.
  // TODO: Make this configurable via an environment variable.
  if ( 'Visit:Exit' === geoEventData.event_type ) {
    console.log( 'Dropped unwanted Visit:Exit event.' );
    response.body = JSON.stringify({ message: 'Dropped unwanted Visit:Exit event.' });
    callback( null, response );
    return;
  }

  // Remove some data we don't need.
  delete geoEventData.event_id;
  delete geoEventData.trigger_id;

  // Store an SNS message to process everything else we need, so we can return quickly.

  const snsMessage = {
    Message:  JSON.stringify( geoEventData ),
    TopicArn: SNS_QUEUE
  };

  aws.config.region = 'ap-southeast-2';
  const sns = new aws.SNS();

  sns.publish( snsMessage, ( error, data ) => {

    if ( error ) {
      exitWithError( error, callback );
      return;
    }

    console.log( 'Queued.' );
    console.log( data );
    response.body = JSON.stringify({ message: 'Queued.' });

    callback( null, response );
    return;

  }); // Sns.publish.
}; // Exports.handler.

/**
 * Parses input from the API caller, depending on the supplied content type. Throws an error if the
 * content type is not understood.
 *
 * @param {string} input       The input.
 * @param {string} contentType The content type of the input. Should be either JSON or form data.
 *                             Defaults to JSON.
 * @return {object} A collection of key and value pairs as supplied in the input.
 */
function parseInput( input, contentType ) {

  // Default to JSON.
  let processedContentType = contentType || 'application/json';

  // Split the content type down to just the MIME type, in case there's encoding included there too.
  processedContentType = processedContentType.split( ';' )[ FIRST_ITEM ];

  let data;

  switch ( processedContentType ) {

    case 'application/json':
      data = JSON.parse( input );
      break;

    case 'application/x-www-form-urlencoded':
      data = querystring.parse( input );
      break;

    default:
      throw new Error( 'Error: Invalid content-type. Please supply either JSON or form data.' );

  } // Switch processedContentType.

  return data;

} // Function parseInput.

/**
 * Exits the Lambda function, in an API Gateway compatible way, while passing an error back.
 * If an HTTP status code is available in the error, that will be used, otherwise defaults to 500.
 */
function exitWithError( error, callback ) {

  const response = {
    isBase64Encoded: false,
    statusCode:      error.statusCode || HTTP_SERVER_ERROR,
    headers:         {},
    body:            JSON.stringify({ error: error })
  };

  console.error( error );

  callback( CI ? error : null, response );
  return;

} // Function exitWithError.
