import { Router } from "express";
//import { shopRouter } from "./shop";
import { productsRouter } from "./products";
import { cartRouter } from "./cart";
import { checkoutRouter } from "./checkout";
import { ordersRouter } from "./orders";

export const tenantApi = Router();

//tenantApi.use("/shop", shopRouter);
tenantApi.use("/products", productsRouter);
tenantApi.use("/cart", cartRouter);
tenantApi.use("/checkout", checkoutRouter);
tenantApi.use("/orders", ordersRouter);
