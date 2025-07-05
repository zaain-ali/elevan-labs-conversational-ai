"use client";
import { requestMicroPhone } from "@/lib/requestMicroPhone";
import { useConversation } from "@elevenlabs/react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

async function getSignedUrl() {
  const response = await fetch("/api/signed-url");
  if (!response.ok) {
    throw Error("Failed to get signed URL");
  }
  const data = await response.json();
  return data.signUrl;
}

const CovAi = () => {
  const conversation = useConversation({
    onConnect: () => console.log("CONNECTED"),
    onDisconnect: () => console.log("DISCONNECTED"),
    onError: (error) => console.error("ERROR", error),
    onMessage: (message) => console.log("MESSAGE", message),
  });

  const startConversation = async () => {
    const hanPermission = await requestMicroPhone();
    if (!hanPermission) {
      alert("Permission denied");
      return;
    }
    const signedUrl = await getSignedUrl();
    await conversation.startSession({ signedUrl });
  };

  const stopConversation = async () => {
    await conversation.endSession();
  };
  return (
    <div className={"flex justify-center items-center gap-x-4"}>
      <Card className={"rounded-3xl"}>
        <CardContent>
          <CardHeader>
            <CardTitle className={"text-center"}>
              {conversation.status === "connected"
                ? conversation.isSpeaking
                  ? `Agent is speaking`
                  : "Agent is listening"
                : "Disconnected"}
            </CardTitle>
          </CardHeader>
          <div className={"flex flex-col gap-y-4 text-center"}>
            <div
              className={cn(
                "orb my-16 mx-12",
                conversation.status === "connected" && conversation.isSpeaking
                  ? "orb-active animate-orb"
                  : conversation.status === "connected"
                  ? "animate-orb-slow orb-inactive"
                  : "orb-inactive"
              )}
            ></div>

            <Button
              variant={"outline"}
              className={"rounded-full"}
              size={"lg"}
              disabled={
                conversation !== null && conversation.status === "connected"
              }
              onClick={startConversation}
            >
              Start conversation
            </Button>
            <Button
              variant={"outline"}
              className={"rounded-full"}
              size={"lg"}
              disabled={conversation === null}
              onClick={stopConversation}
            >
              End conversation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export { CovAi };
