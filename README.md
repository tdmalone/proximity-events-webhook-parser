# Proximity Events Webhook Parser

A simple AWS Lambda function that 'queues' custom geolocation trigger events from the [Proximity Events](http://proximityevents.com/) iPhone app in an SNS topic. Designed to be run via the AWS API Gateway as a Lambda proxy function.

(I don't have any relation to the Proximity Events app; I just found it an easy way to enable some location-based automation in my life!)

This function attempts to normalise the data received from the app, because sometimes it sends JSON and sometimes it sends `x-www-form-urlencoded` data, with different fields provided for each. I'm not sure why, but there you go.

Other than that, this func tries to do its job quickly and get out of the way, while providing some error reporting if something goes wrong. I suggest using [cloudwatchToPapertrail](https://github.com/tdmalone/cloudwatch-to-papertrail) or another log monitoring tool to pick up what's happening.

There are no dependencies to install.

## TODO

* Add setup and installation instructions (or a script to do it)
* Add better tests
* Add timezone handling (using a [geolocation time zone API](https://developers.google.com/maps/documentation/timezone/start)?)
* Make the `Visit:Exit` event dropping configurable
* Use a [reverse geocoding service](https://developers.google.com/maps/documentation/geocoding/intro#ReverseGeocoding) to get the address for form data events
