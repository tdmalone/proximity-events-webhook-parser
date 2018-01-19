/**
 * Queues custom geolocation events sent from devices such as iPhones.
 *
 * @author Tim Malone <tim@timmalone.id.au>
 * @see ::runGeoEvent
 * @see http://proximityevents.com/faq/index.html
 */

const AWS = require( 'aws-sdk' );
AWS.config.region = 'ap-southeast-2';

const sns = new AWS.SNS();

exports.handler = ( event, context, callback ) => {

  // Put together the event data we want.
  const geoEventData = JSON.parse( event.body );
  geoEventData.person = event.queryStringParameters.person;
  
  // Remove some data we don't need.
  delete geoEventData.event_id;
  delete geoEventData.trigger_id;

  const snsMessage = {
    Message:  JSON.stringify( geoEventData ),
    TopicArn: process.env.SNS_QUEUE
  };

  sns.publish( snsMessage, ( error, data ) => {
    
    const response = {
      isBase64Encoded: false,
      headers: {}
    };
    
    if ( error ) {
      console.log( error );
      response.statusCode = 500;
      response.body = JSON.stringify({ error: error });
    } else {
      console.log( data );
      response.statusCode = 200;
      response.body = JSON.stringify({ message: 'Queued.' });
    }
    
    callback( null, response );
    
  });

}; // Exports.handler.
