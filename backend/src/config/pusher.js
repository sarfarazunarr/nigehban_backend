const Pusher = require('pusher');

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || "2167634",
  key: process.env.PUSHER_KEY || "8becfba0db54590a6632",
  secret: process.env.PUSHER_SECRET || "3d434c61ff4573c231f7",
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap2",
  useTLS: true
});

module.exports = pusher;
