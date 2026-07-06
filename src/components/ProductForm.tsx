import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Upload, X, Package, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { CompanyProfile, Product } from "@/types";
import {
  saveProduct,
  getCompanyProfile,
  uploadProductImage,
  getProducts,
} from "@/lib/storage";

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (product: Product) => void;
  product?: Product | null;
}

export function ProductForm({
  open,
  onOpenChange,
  onSuccess,
  product: editingProduct,
}: ProductFormProps) {
  const buildVariantKey = (input: { name?: string }) =>
    (input.name || "").toString().trim().toLowerCase();

  const [saving, setSaving] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingProducts, setExistingProducts] = useState<Product[]>([]);
  const [productType, setProductType] = useState<"serialized" | "standard">(
    "serialized",
  );

  const [formData, setFormData] = useState({
    name: "",
    purchasePrice: "",
  });

  useEffect(() => {
    if (editingProduct) {
      const hasImei = Boolean((editingProduct.imeiNumber || "").trim());
      setProductType(
        editingProduct.trackingType ||
          (hasImei ? "serialized" : "standard"),
      );
      setFormData({
        name: editingProduct.name,
        purchasePrice: String(editingProduct.purchasePrice || ""),
      });
      setImagePreview(editingProduct.imageUrl || null);
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingProduct]);

  useEffect(() => {
    const loadData = async () => {
      const [profile, productsData] = await Promise.all([
        getCompanyProfile(),
        getProducts(),
      ]);
      setCompanyProfile(profile);
      setExistingProducts(productsData);
    };
    loadData();
  }, [editingProduct]);

  const resetForm = () => {
    setProductType("serialized");
    setImageFile(null);
    setImagePreview(null);
    setFormData({
      name: "",
      purchasePrice: "",
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!formData.name.trim()) {
        toast.error("Product name is required");
        return;
      }
      const computedVariantKey = buildVariantKey({ name: formData.name });
      const masterDuplicate = existingProducts.find(
        (p) =>
          p.id !== editingProduct?.id &&
          buildVariantKey({ name: p.name }) === computedVariantKey,
      );
      if (masterDuplicate) {
        toast.error(
          `Product master already exists as ${masterDuplicate.name} (${masterDuplicate.model || "N/A"}).`,
        );
        return;
      }

      const productId = editingProduct?.id || crypto.randomUUID();

      let imageUrl = editingProduct?.imageUrl || "";
      if (imageFile) {
        imageUrl = await uploadProductImage(productId, imageFile);
      }

      const isStandardType = productType === "standard";
      const purchasePriceNum = isStandardType
        ? parseFloat(formData.purchasePrice) || 0
        : editingProduct?.purchasePrice || 0;
      if (isStandardType && purchasePriceNum <= 0) {
        toast.error("Standard product requires purchase price");
        return;
      }

      const product: Product = {
        id: productId,
        name: formData.name.trim(),
        variantKey: computedVariantKey,
        trackingType: productType === "serialized" ? "serialized" : "standard",
        model: formData.name.trim(),
        itemNo: "",
        imeiNumber: "",
        storage: "",
        color: "",
        barcode: "",
        unit: "pcs",
        price: 0,
        purchasePrice: purchasePriceNum,
        sellingPrice: 0,
        stock: editingProduct?.stock || 0,
        whereToBuy: editingProduct?.whereToBuy || "",
        vendorId: editingProduct?.vendorId || "",
        weight: editingProduct?.weight || 0,
        weightUnit: editingProduct?.weightUnit || "g",
        createdAt: editingProduct?.createdAt || new Date().toISOString(),
        imageUrl: imageUrl,
      };

      await saveProduct(product);

      toast.success(
        editingProduct
          ? "Product updated successfully"
          : "Product created successfully",
      );
      onSuccess(product);
      onOpenChange(false);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-4xl h-[90vh] sm:h-[88vh] rounded-xl p-0 overflow-hidden flex flex-col gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-background sticky top-0 z-20 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="h-5 w-5 text-primary" />
            {editingProduct ? "Edit Product" : "Create Product"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Complete details and save.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 h-full">
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
            <Card className="border-border/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Basic Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!editingProduct && (
                  <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setProductType("serialized")}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        productType === "serialized"
                          ? "border-primary bg-primary/10"
                          : "border-border/70 bg-background"
                      }`}
                    >
                      <p className="text-sm font-semibold">Serialized (IMEI)</p>
                      <p className="text-xs text-muted-foreground">
                        One device per IMEI
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductType("standard")}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        productType === "standard"
                          ? "border-primary bg-primary/10"
                          : "border-border/70 bg-background"
                      }`}
                    >
                      <p className="text-sm font-semibold">Standard</p>
                      <p className="text-xs text-muted-foreground">
                        Quantity-based inventory
                      </p>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Product Image</Label>
                    <div className="relative group w-full max-w-[180px]">
                      <div className="aspect-square border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center overflow-hidden bg-muted">
                        {imagePreview ? (
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Upload className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      {imagePreview && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageFile(null);
                            setImagePreview(null);
                          }}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-4">
                    <div className="space-y-2">
                      <Label>Product Name *</Label>
                      <Input
                        required
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* <Card className="border-border/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Tax & Classification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>HSN Code</Label>
                    <Input
                      onChange={(e) =>
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>GST %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      onChange={(e) =>
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Stock, IMEI, and pricing are handled through Purchase Bills.
                </p>
              </CardContent>
            </Card> */}

            {(productType === "standard" ||
              (editingProduct && editingProduct.trackingType === "standard")) && (
              <Card className="border-border/80">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <IndianRupee className="h-4 w-4 text-primary" />
                    Standard Cost
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Purchase Price *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.purchasePrice}
                        onChange={(e) =>
                          setFormData({ ...formData, purchasePrice: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="shrink-0 border-t bg-background px-6 py-3 shadow-[0_-10px_25px_-18px_rgba(0,0,0,0.45)] sticky bottom-0 z-20">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground hidden sm:block">
                Required fields: Name
                {productType === "standard" ? ", Purchase Price" : ""}
              </p>
              <div className="ml-auto flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={saving}>
                  {editingProduct ? "Update Product" : "Create Product"}
                </Button>
              </div>
            </div>
          </div>
        </form>

      </DialogContent>
    </Dialog>
  );
}
