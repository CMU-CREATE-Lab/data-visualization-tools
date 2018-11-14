# Mobile Stories

Quick docs for dev/testing of the mobile stories stuff.

## Setup

The general assumption is that your local EarthTime server is at http://earthtime.local and the mobile page is served from http://earthtime-mobile-story.local.  These docs walk through the process of getting it set up on a Mac running Apache 2.4.

### Hosts File

As root, edit your `/etc/hosts` file and add the following two lines to the end:

    127.0.0.1       earthtime.local
    127.0.0.1       earthtime-mobile-story.local

### EarthTime config

In your instance of the EarthTime code base, copy this file:

    examples/webgl-timemachine/example-configs/config-local.js
    
... to here:

    examples/webgl-timemachine/config-local.js

And then edit the new copy and set the `waypointSliderContentPath` property to:

    "https://docs.google.com/spreadsheets/d/1rCiksJv4aXi1usI0_9zdl4v5vuOfiHgMRidiDPt1WfE/edit#gid=1596808134"

### Apache Config

Beginning by uncommenting these lines in your Apache config (`/etc/apache2/httpd.conf`):

    LoadModule vhost_alias_module libexec/apache2/mod_vhost_alias.so

    LoadModule rewrite_module libexec/apache2/mod_rewrite.so
    
Find these lines:

    # Virtual hosts
    #Include /private/etc/apache2/extra/httpd-vhosts.conf

...leave them commented out, and add this line after it:

    Include /private/etc/apache2/vhosts/*.conf

Create this directory (as root), if necessary:

    /etc/apache2/vhosts
    
In that `vhosts` directory, create a file named `earthtime-mobile-story.local.conf` and put this in it, changing filesystem paths as necessary:

```
<VirtualHost *:80>
   DocumentRoot "/Users/chris/Documents/Work/Projects/data-visualization-tools/examples/webgl-timemachine/stories"
   ServerName earthtime-mobile-story.local
   ErrorLog "/var/log/apache2/earthtime-mobile-story.local-error_log"
   CustomLog "/var/log/apache2/earthtime-mobile-story.local-access_log" common
   
   <Directory "/Users/chris/Documents/Work/Projects/data-visualization-tools/examples/webgl-timemachine/stories">
      AllowOverride All
      Require all granted
   </Directory>
</VirtualHost>
```

Create another vhost file named `earthtime.local.conf` and put this in it, again changing file system paths as necessary:

```
<VirtualHost *:80>
   ServerName earthtime.local
   DocumentRoot /Users/chris/Documents/Work/Projects/data-visualization-tools/examples/webgl-timemachine
   Options FollowSymLinks
   Alias "/timemachine" "/Users/chris/Documents/Work/Projects/data-visualization-tools/timemachine"
   Alias "/js" "/Users/chris/Documents/Work/Projects/data-visualization-tools/js"
   Alias "/css" "/Users/chris/Documents/Work/Projects/data-visualization-tools/css"
   Alias "/images" "/Users/chris/Documents/Work/Projects/data-visualization-tools/images"
   Alias "/info" "/Users/chris/Documents/Work/Projects/data-visualization-tools/info.html"
   
   Header always set Access-Control-Allow-Origin "*"
   Header set Cache-Control "max-age=60, public, must-revalidate"
   
   <Directory "/Users/chris/Documents/Work/Projects">
      Order Deny,Allow
      Allow from all
      Satisfy any
   </Directory>
   
   RewriteEngine on
   
   # LANDING PAGE
   RewriteRule "^/index.html$" "/landing/index.html" [PT]
   
   # EXPLORE PAGE
   RewriteRule "^/explore$"  "/index.html" [PT]
   
   # INTERACTIVE STORIES
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_URI} !^.*\.(jpg|css|js|gif|png|json|geojson|svg|html)$ [NC]
   RewriteRule "^/stories/(.+)$" "/index.html" [PT]
   
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_URI} ^/stories/(.*)\.(jpg|css|js|gif|png|json|geojson|svg|html)$ [NC]
   RewriteRule "^/stories/(.*)\.(jpg|css|js|gif|png|json|geojson|svg|html)$" "/$1\.$2" [PT]
   
   # CAPTIVE STORIES
   RewriteRule "^/m/stories/(.+)\.(js|css)"  "/stories/$1\.$2" [PT]
   RewriteRule "^/m/stories/status$" "/stories/status/index.html" [PT]
   RewriteRule "^/m/stories/status/(.*)$" "/stories/status/index.html" [PT]
   RewriteCond %{REQUEST_URI} !status.*
   RewriteRule "^/m/stories/(.+)$"  "/stories/index.html" [PT]
   
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteRule ^([^\.]+)$ $1.html [NC,L]
   
   # Redirect countries that do not support Google products
   RewriteCond %{REQUEST_URI} config-local.js [NC]
</VirtualHost>
```

Now check your Apache config:

    $ sudo apachectl configtest
    
If all looks good, then restart Apache:

    $ sudo apachectl restart

## Full Screen vs Container

This directory contains two examples of embedding for mobile: one that's full screen (with no option for other content on the page), and another that embeds into a `div` with other content above and below defined by the page creator.

### Full Screen

Try out the full screen version here:

   http://earthtime-mobile-story.local/mobile-embed-fullscreen.html

### Container

Try out the container version here:

   http://earthtime-mobile-story.local/mobile-embed.html
   