const AWS = require("aws-sdk");
// Enter copied or downloaded access ID and secret key here

// The name of the bucket that you have created
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_ID,
  region: process.env.AWS_REGION,
});

const deleteFile = (fileName) => {
  return new Promise((resolve, reject) => {
    // Setting up S3 delete parameters
    const params = {
      Bucket: BUCKET_NAME,
      Key: "files/" + fileName, // File name you want to delete from S3
    };

    // Deleting file from the bucket
    s3.deleteObject(params, function (err, data) {
      if (err) {
        console.log(err);
        reject(err);
      }
      console.log(`File deleted successfully. ${data}`);
      resolve(data);
    });
  });
};
module.exports = deleteFile;
