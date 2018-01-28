# Proximity Events Webhook Parser

A simple [AWS Lambda](https://aws.amazon.com/lambda/) function that 'queues' geolocation trigger events from the [Proximity Events](http://proximityevents.com/) iPhone app in an [SNS](https://aws.amazon.com/sns/) topic. Designed to be run via the [AWS API Gateway](https://aws.amazon.com/api-gateway/) as a Lambda proxy function.

(I don't have any relation to the Proximity Events app; I just found it an easy way to enable some location-based automation in my life!)

This function attempts to normalise the data received from the app, because sometimes it sends JSON and sometimes it sends `x-www-form-urlencoded` data, with different fields provided for each. I'm not sure why, but there you go. This function will get you - as much as possible - the same fields no matter what.

It also performs minor cleanups on the data and drops any `Visit:Exit` events, because they're unlike any of the other events in that they send an address that you _were_ at, some time after the app detects that you left, which means it is no longer current and is superceded by any other event, such as `Location:Update`.

Other than that, this function tries to do its job quickly and get out of the way, while providing some error reporting if something goes wrong. I suggest using [cloudwatchToPapertrail](https://github.com/tdmalone/cloudwatch-to-papertrail) or another log monitoring tool to pick up what's happening.

Oh, and this function will also combine anything you add in the GET parameters - which can often be useful to indicate which phone the input is coming from!

## Usage

Full instructions coming soon.

For now, the instructions basically are to set up an API Gateway endpoint and a Lambda function 😀. Create your geofences on the app, and set them - and any other events you wish to send - with a POST request to your API Gateway endpoint. You can also add context via GET parameters if you wish - eg. `?phone=work-phone`.

There are no dependencies to install.

## Tests

Run `yarn test`.

To have tests properly fail (non-zero exit code) when something goes wrong, `export CI=true` first. Otherwise you'll get JSON responses with HTTP error codes instead (made for the AWS API Gateway). For tests to succeed, you'll also need to have exported `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, and `SNS_QUEUE` with your desired values.

## TODO

* Add proper setup and installation instructions (or a script to do it)
* Add better tests
* Add timezone handling (using a [geolocation time zone API](https://developers.google.com/maps/documentation/timezone/start)?)
* Make the `Visit:Exit` event dropping configurable
* Use a [reverse geocoding service](https://developers.google.com/maps/documentation/geocoding/intro#ReverseGeocoding) to get the address for form data events

## License

[MIT](LICENSE).
