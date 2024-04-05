const fs = require("fs");
const AWS = require("aws-sdk");
// Enter copied or downloaded access ID and secret key here

// The name of the bucket that you have created
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_ID,
  region: process.env.AWS_REGION,
});

const uploadFile = (fileName, uploadName) => {
  return new Promise((resolve, reject) => {
    // Read content from the file
    const fileContent = fs.readFileSync("src/" + fileName);

    // Setting up S3 upload parameters
    const params = {
      Bucket: BUCKET_NAME,
      Key: "files/" + uploadName, // File name you want to save as in S3
      Body: fileContent,
    };

    // Uploading files to the bucket
    s3.upload(params, function (err, data) {
      if (err) {
        console.log("oh la la ");
        reject(err);
      }

      try {
        // fs.unlinkSync(fileName);
      } catch (err) {
        console.log(err);
      }
      //  console.log(`File uploaded successfully. ${data.Location}`);
      resolve(data.Location);
    });
  });
};
module.exports = uploadFile;

// uploadFile(fileName)
