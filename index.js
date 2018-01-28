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

  // Put together the event data we want.
  let geoEventData;
  try {
    geoEventData = parseInput( event.body, event.headers['content-type']);
  } catch ( error ) {
    exit( 'Error: Could not parse input. ' + error + '. ' + event.body, null, callback );
    return;
  }

  // Drop Visit:Exit events, as they'll often supply an old address way too late.
  // TODO: Make this configurable via an environment variable.
  if ( 'Visit:Exit' === geoEventData.event_type ) {
    exit( null, { message: 'Dropped unwanted Visit:Exit event.' }, callback );
    return;
  }

  // Add any optional GET parameters to the request.
  // This will have the side-effect of overriding the POST params if any of them are the same.
  Object.keys( event.queryStringParameters ).forEach( ( key ) => {
    geoEventData[ key ] = event.queryStringParameters[ key ];
  });

  // Remove some data we don't need.
  delete geoEventData.event_id;
  delete geoEventData.trigger_id;

  // Normalize the data that Proximity Events sends with its occasional form-data requests.
  if ( 'application/x-www-form-urlencoded' === event.headers['content-type']) {
    geoEventData = normalizeFormData( geoEventData );
  }

  // Ensure no data is going through as a blank string, but rather than it's set to null.
  Object.keys( geoEventData ).forEach( ( key ) => {
    if ( '' === geoEventData[ key ]) geoEventData[ key ] = null;
  });

  // Store an SNS message to process everything else we need, so we can return quickly.
  sendSnsMessage( geoEventData, callback );

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
 * Normalizes the data that Proximity Events sends with its occasional form-data requests. We
 * want to use the same fields that we have available for the usual JSON requests.
 *
 * Form data requests are assumed to be Geofence enters or exits, as so far in our testing that
 * is all they have appeared to be.
 */
function normalizeFormData( data ) {
  /* eslint-disable camelcase */

  data.comments = 'Converted from form-data';

  data.event_latitude = data.latitude;
  data.event_longitude = data.longitude;
  data.event_accuracy_m = '0.0'; // Unavailable.
  data.event_address = 'Unknown location'; // Unavailable, although we could look it up.
  data.trigger_name = data.id;
  data.trigger_type = 'Geofence';

  // Generate eg. 'Geofence:Exit' from 'exit'.
  data.event_type = (
    'Geofence:' + data.trigger.replace( /^(\w)/, letter => letter.toUpperCase() )
  );

  // Convert eg. '1516705689.304757' to eg. '2018-01-09T21:38:30+11:00'.
  // TODO: Need to add timezone handling to this.
  data.event_date = new Date( parseInt( data.timestamp * TO_MILLISECONDS ) );
  data.event_date = data.event_date.toISOString();

  // Delete superfluous data.
  const deletableProps = [
    'device',
    'device_model',
    'device_type',
    'latitude',
    'longitude',
    'id',
    'trigger',
    'timestamp'
  ];
  deletableProps.forEach( ( key ) => {
    delete data[ key ];
  });

  return data;

  /* eslint-enable camelcase */
} // Function normalizeFormData.

/**
 * Sends an SNS messaage, calling a callback on completion.
 */
function sendSnsMessage( message, callback ) {

  const snsMessage = {
    Message:  JSON.stringify( message ),
    TopicArn: SNS_QUEUE
  };

  aws.config.region = 'ap-southeast-2';
  const sns = new aws.SNS();

  sns.publish( snsMessage, ( error ) => {

    if ( error ) {
      exit( error, null, callback );
      return;
    }

    exit( null, { message: 'Queued.' }, callback );
    return;

  }); // Sns.publish.
} // Function sendSnsMessage.

/**
 * Exits the Lambda function, in an API Gateway compatible way, while passing any errors back.
 * If an HTTP status code is available in the error, that will be used, otherwise defaults to 500.
 *
 * If running in CI, errors will be passed back as errors, rather than API Gateway responses.
 *
 * @param {object|null} error
 * @param {object|null} data
 * @param {function} callback
 */
function exit( error, data, callback ) {

  // Prepare the API response.
  const response = {
    isBase64Encoded: false,
    statusCode:      error ? ( error.statusCode || HTTP_SERVER_ERROR ) : HTTP_OK,
    headers:         {},
    body:            JSON.stringify( error ? { error: error } : data )
  };

  const logFunction = error ? console.error : console.info;
  logFunction( error || data );

  callback( error && CI ? error : null, response );
  return;

} // Function exit.
