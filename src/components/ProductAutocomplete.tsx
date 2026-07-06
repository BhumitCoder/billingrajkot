import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Product } from "@/types"

interface ProductAutocompleteProps {
  products: Product[]
  value: string
  onChange: (value: string) => void
  onSelect: (product: Product) => void
  onCreateProduct?: () => void
  onEnterWithText?: (text: string) => void
  placeholder?: string
  type: "name" | "hsn"
  className?: string
}

export function ProductAutocomplete({
  products,
  value,
  onChange,
  onSelect,
  onCreateProduct,
  onEnterWithText,
  placeholder = "Select product...",
  type,
  className,
}: ProductAutocompleteProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value)

  // Update internal input value when prop changes
  React.useEffect(() => {
    setInputValue(value)
  }, [value])

  const filteredProducts = React.useMemo(() => {
    if (!inputValue) return products.slice(0, 50) // Show first 50 if empty
    
    const search = inputValue.toLowerCase()
    return products.filter((product) => {
      const blob = [
        product.name,
        product.model || "",
        product.itemNo || "",
        product.storage || "",
        product.color || "",
        product.barcode || "",
      ]
        .join(" ")
        .toLowerCase()
      if (type === "name") {
        return blob.includes(search)
      } else {
        return blob.includes(search)
      }
    }).slice(0, 50) // Limit results for performance
  }, [products, inputValue, type])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
           <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between font-normal text-left px-3", !value && "text-muted-foreground", className)}
          >
            {value || placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}> 
          <CommandInput
            placeholder={placeholder}
            value={inputValue}
            onValueChange={(val) => {
                setInputValue(val)
                onChange(val)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filteredProducts.length === 0 && inputValue.trim() && onEnterWithText) {
                e.preventDefault()
                onEnterWithText(inputValue.trim())
                setOpen(false)
              }
            }}
          />
          <CommandList>
            <CommandEmpty>
              <div className="py-4 text-center space-y-3">
                <p className="text-sm text-muted-foreground">No product found ! Write product name and click Enter to Create new product.</p>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {/* {onCreateProduct && (
                <CommandItem
                  value="__create_product__"
                  onSelect={() => {
                    onCreateProduct()
                    setOpen(false)
                  }}
                  className="font-medium text-primary"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add New Product
                </CommandItem>
              )} */}
              {filteredProducts.map((product) => (
                <CommandItem
                  key={product.id}
                  onSelect={() => {
                    const displayValue = (product.model || product.name || "").toUpperCase()
                    setInputValue(displayValue)
                    onChange(displayValue)
                    onSelect(product)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4")} />
                  <span>{(product.model || product.name || "").toUpperCase()}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
