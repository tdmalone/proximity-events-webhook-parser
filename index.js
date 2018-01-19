/**
 * Handles custom geolocation events sent from devices such as iPhones.
 *
 * @author Tim Malone <tim.malone@chromatix.com.au>
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
    TopicArn: 'arn:aws:sns:ap-southeast-2:873114526714:location-notifications'
  };

  sns.publish( snsMessage, ( error, data ) => {
    if ( error ) callback( error );
    console.log( data );
    callback( null, 'Complete.' );
  });

}; // Exports.handler.
