/**
 * Queues custom geolocation events sent from devices such as iPhones.
 * Designed to be invoked by the AWS API Gateway as a Lambda Proxy function.
 *
 * @author Tim Malone <tim@timmalone.id.au>
 * @see ::runGeoEvent
 * @see http://proximityevents.com/faq/index.html
 */

exports.handler = ( event, context, callback ) => {

  // Prepare the API response.
  const response = {
    isBase64Encoded: false,
    statusCode:      200,
    headers:         {}
  };

  // Put together the event data we want.
  const geoEventData = JSON.parse( event.body );
  geoEventData.person = event.queryStringParameters.person;

  // Drop Visit:Exit events, as they'll often supply an old address way too late.
  if ( 'Visit:Exit' === geoEventData.event_type ) {
    response.body = JSON.stringify({ message: 'Dropped.' });
    callback( null, response );
    return;
  }

  // Remove some data we don't need.
  delete geoEventData.event_id;
  delete geoEventData.trigger_id;

 // Store an SNS message to process everything else we need, so we can return quickly.

  const snsMessage = {
    Message:  JSON.stringify( geoEventData ),
    TopicArn: process.env.SNS_QUEUE
  };

  const AWS = require( 'aws-sdk' );
  AWS.config.region = 'ap-southeast-2';

  const sns = new AWS.SNS();

  sns.publish( snsMessage, ( error, data ) => {

    if ( error ) {
      console.log( error );
      response.statusCode = 500;
      response.body = JSON.stringify({ error: error });
    } else {
      response.body = JSON.stringify({ message: 'Queued.' });
    }

    callback( null, response );

  }); // Sns.publish.
}; // Exports.handler.
