# Mii Studio Mii Loader
Import and export Miis from Nintendo's online Mii Studio, using Mii Studio codes.

Code originally written by [HEYimHeroic](https://github.com/HEYimHeroic). Browser extension by [jonbarrow](https://github.com/jonbarrow). Bookmarklet polished by [bendevnull](https://github.com/bendevnull).

# Browser Extension (New!)
[![Google Chrome Extension Store](https://github.com/HEYimHeroic/MiiStudioMiiLoader/assets/48461034/54910ba4-0d41-4329-994c-9de0a4629184)](https://chrome.google.com/webstore/detail/mii-studio-mii-loader/aghjddgonhejbnlpfhncfbajpbihhnmf) [![Firefox Add-on Store](https://github.com/HEYimHeroic/MiiStudioMiiLoader/assets/48461034/d737c62f-8fca-4ee7-9049-3b46afc69529)](https://addons.mozilla.org/en-US/firefox/addon/mii-studio-mii-loader/) [![Microsoft Edge Add-on Store](https://github.com/HEYimHeroic/MiiStudioMiiLoader/assets/48461034/837b6bb5-fb0a-4b7f-8b0d-3713b450ea59)](https://microsoftedge.microsoft.com/addons/detail/mii-studio-mii-loader/nndjnkonkedjnnnkfajakpbdnelppfbo)

Now the Mii Studio Mii Loader can be used through a regular browser extension. Head to Nintendo's [official Mii Studio site](https://my.nintendo.com/mii). (You may have to enter the site via the My Nintendo site first. Make sure you're signed into your My Nintendo account.) Make sure that you're not making a new Mii. If you are, save the new Mii, and go back to edit it again.

Clicking on the extension with a Mii loaded will display its Mii Studio code, ready to be copied. If it doesn't work, make a change to the Mii (you can immediately change it back) and the Mii Studio code should be there. This should automatically update as you edit the Mii.

To load a Mii Studio code, begin editing a Mii the same way as before, but now when clicking on the extension, enter a Mii Studio code into the textbox below it and click "Update Mii Studio Data". Then, refresh the page, and click "Continue editing" in the website for your Mii to appear. (Hitting "Start from scratch" will reset the process.)

## Installing the Browser Extension Manually

To manually install this browser extension, follow these steps:
1. Download the [latest release](https://github.com/HEYimHeroic/MiiStudioMiiLoader/releases) of the Mii Studio Mii Loader browser extension. Unzip the download to a location you won't lose it, like an extensions folder.
2. Go to your browser's extensions settings page. For example, on Google Chrome, the link is `chrome://extensions/`, but otherwise accessible through settings for other browsers.
3. Find the "Developer mode" option (or something similarly named) and enable it.
4. Click the button to "Load unpacked extension" and navigate to the folder you unzipped (the contents should contain `manifest.json`, `/popup/`, and `/images/`). Choose this folder as the unpacked extension's location.

# Bookmarklet Instructions
For those still unaware of the browser extension, or for one reason or another need to use the bookmarklet instead, the old bookmarklet version of the tool is still available. Below are the old instructions for that:

Make a new bookmark, and paste the following JavaScript code into the URL section of the bookmark:
`javascript:(function () {var s = document.createElement('script');s.setAttribute('src', 'https://heyimheroic.github.io/MiiStudioMiiLoader/miiLoader.js');document.body.appendChild(s);}());`

Once there, head to Nintendo's [official Mii Studio site](https://my.nintendo.com/mii). (You may have to enter the site via the My Nintendo site first. Make sure you're signed into your My Nintendo account.)

Click on a Mii, click "Edit", and click the bookmark you just made. (Make sure that you're not making a new Mii. If you are, save the new Mii, and go back to edit it again.)

Follow the instructions given to you in the popup box's prompt.

If you are loading a Mii, refresh the page, and select the button to continue editing the Mii. The Mii will transform into the Mii you're attempting to load.

You can read more about the specifics on using the tool at the [Mii Library](https://www.miilibrary.com/contactfaqother/FAQ#h.pf4lefk6peji).
