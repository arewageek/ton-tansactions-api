import express, { type Request, type Response } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import TonWeb from "tonweb";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(bodyParser.json());

const tonweb = new TonWeb(
  new TonWeb.HttpProvider("https://testnet.toncenter.com/api/v2/jsonRPC", {
    apiKey: process.env.TON_API_KEY!,
  })
);

// initialize wallet, sewno, and make privateKey readable by sdk
const initializeWalletAndSeqno = async (
  privateKey: string
): Promise<{ wallet: any; seqno: any; secretKey: any }> => {
  const wallet = tonweb.wallet.create({
    publicKey: tonweb.utils.base64ToBytes(privateKey),
  });

  const seqno = (await wallet.methods.seqno().call()) as number;

  const secretKey = TonWeb.utils.base64ToBytes(privateKey as string);

  return { wallet, seqno, secretKey };
};

// Endpoint to send a transaction
app.post("/send-transaction", async (req: Request, res: Response) => {
  const { to, amount, privateKey } = req.body;
  const { wallet, seqno, secretKey } = await initializeWalletAndSeqno(
    privateKey
  );

  try {
    const address = await wallet.getAddress();

    const message = await wallet.methods
      .transfer({
        secretKey,
        toAddress: to,
        amount,
        seqno,
      })
      .estimateFee();

    const Cell = TonWeb.boc.Cell;
    const cell = new Cell();
    cell.bits.writeUint(0, 32);
    cell.bits.writeAddress(address);
    cell.bits.writeGrams(1);
    console.log(cell.print());

    const bocBytes = await cell.toBoc();
    tonweb.sendBoc(bocBytes);

    res.json({
      success: true,
      message: "Transaction sent successfully",
      log: bocBytes,
    });
  } catch (error: any) {
    console.error({ error });
    res.status(500).json({
      success: false,
      message: "Transaction failed",
      log: error.message,
    });
  }
});

app.post("/send-token", async (req: Request, res: Response) => {
  const { to, amount, tokenAddress, privateKey } = req.body;
  const { secretKey } = await initializeWalletAndSeqno(privateKey);

  try {
    // const tokenContract = new TonWeb.Contract({});
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

app.post("/transaction/:hash", async (req: Request, res: Response) => {
  const { hash } = req.params;

  try {
    const transactionDetails = await tonweb.getTransactions(hash);
    if (!transactionDetails) throw new Error("No transaction found");

    res.json({ success: true, data: transactionDetails });
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

app.get(
  "/wallet/:address/transactions",
  async (req: Request, res: Response) => {
    const { address } = req.params;

    try {
      // Fetch transaction history from the TON Center API

      const response = await axios.get(
        `https://testnet.toncenter.com/api/v2/getTransactions`,
        {
          params: {
            address: address,
            limit: 50,
            apiKey: process.env.TON_API_KEY!,
          },
        }
      );

      const transactions = response.data.result;

      if (!transactions || transactions.length === 0)
        throw new Error("No tranaction found for this wallet");

      res.status(200).json({ success: true, data: transactions });
    } catch (error: any) {
      res.json({
        success: false,
        message: error.message,
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
