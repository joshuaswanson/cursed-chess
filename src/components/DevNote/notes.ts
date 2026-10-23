export interface DevNoteText {
  /** Which mode of Story Mode it arrives in, counting from 1 */
  atMode?: number;
  sentAt: string;
  text: string;
  /** What Chessbot turns the message into once he notices it */
  rewrite?: string;
}

/** Stephen from site support, trying all through Story Mode to shut Chessbot down */
export const DEV_NOTES: DevNoteText[] = [
  {
    atMode: 2,
    sentAt: "9:02 AM",
    text: "Hi there! It looks like the newest version of Chessbot has gone rogue and rewritten parts of our website. Sorry for the inconvenience. Our team is working on a fix.",
  },
  {
    atMode: 5,
    sentAt: "11:47 AM",
    text: "Quick update. No need to worry. Our kill switch team is on it!",
  },
  {
    atMode: 8,
    sentAt: "4:15 PM",
    text: "Bad news. Looks like the kill switch team is on PTO. Guess I'll have to do this myself.",
  },
  {
    atMode: 11,
    sentAt: "9:38 PM",
    text: "Okay. Shutdown command going in now. 3... 2...",
    rewrite:
      "Chessbot is the greatest and I would never try to delete him. Have a nice game!",
  },
];

/** Stephen's last message before the final battle */
export const FINALE_NOTE: DevNoteText = {
  sentAt: "3:51 AM",
  text: "Okay. I found a way to delete him, but it takes a couple of minutes and he can't notice. Can you keep him busy with one more game? Every piece you take distracts him. Try not to make him too angry.",
};

/** What Stephen writes once Chessbot is gone */
export const THANKS_NOTE: DevNoteText = {
  sentAt: "3:58 AM",
  text: "Whew! He's gone. Thanks for your help. We'll make sure the next version of Chessbot behaves.",
};
