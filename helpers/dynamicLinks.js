// const { initializeApp } = require("firebase-admin/app");
// const { credential } = require("firebase-admin");
// const admin = require("firebase-admin");
// const serviceAccount = require('../files/src/gemmint-practice-firebase-adminsdk-2656r-17ec975d31.json');

// const app=initializeApp({
//   credential: credential.cert(serviceAccount)
// });

const axios=require('axios')

const dynamicLinkParams = async (userId) => {
  const dLink=JSON.stringify({
    domainUriPrefix: "https://gemmintpractice.page.link/invite",
    link: `https://gemmintclub/welcome?ref=${encodeURIComponent(userId)}`,
    android: {
      packageName: "com.gemmint",
    },
  })

  await axios.post('https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=AIzaSyDjCeCEggbZvoPHdk0wt9MJLs_Yau6hJVE', {
    headers: {
      'content-type': 'application/json'
    },
    data:dLink
  })
    .then(res => {
      return res
    })
  
    .catch(err => {
      return err.message
    })

  
};

module.exports=dynamicLinkParams



// admin
//   .dynamicLinks()
//   .createShortLink(dynamicLinkParams("user123"))
//   .then((link) => {
//     console.log(`Dynamic link generated: ${link.shortLink}`);
//   })
//   .catch((error) => {
//     console.error(`Error generating dynamic link: ${error}`);
//   });
